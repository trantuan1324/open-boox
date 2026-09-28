import { Injectable } from '@nestjs/common';
import { type LoanStatus, Prisma } from '@prisma/client';
import {
  type BorrowInput,
  type BorrowResult,
  LOAN_PAGE_SIZE,
  type LoanDto,
  OPEN_LOAN_STATUSES,
  type Paged,
  type ReturnInput,
  type ReturnResult,
} from '@open-boox/shared';
import { DomainError } from '../common/errors/domain-error';
import { InventoryService } from '../inventory/inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import { ShipmentsService } from '../shipments/shipments.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { AddressesService } from '../users/addresses.service';
import { lockLoans } from './lock-loans';

// Which shipment tells a loan's progress (spec §4.4a): the delivery until the book is on its way back.
function trackedShipmentId(loan: { status: LoanStatus; deliveryShipmentId: string; returnShipmentId: string | null }): string {
  return loan.status === 'RETURN_REQUESTED' || loan.status === 'RETURNED' ? loan.returnShipmentId! : loan.deliveryShipmentId;
}

@Injectable()
export class LoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
    private readonly inventory: InventoryService,
    private readonly shipments: ShipmentsService,
    private readonly addresses: AddressesService,
  ) {}

  // spec §4.3, one transaction: lock the subscription (queues every borrow of this user), check the period and
  // the limit, reserve a copy per book (SKIP LOCKED), then one LOAN_DELIVERY for all loans.
  async borrow(userId: string, input: BorrowInput): Promise<BorrowResult> {
    const address = await this.addresses.snapshotFor(userId, input.addressId);
    const bookIds = [...input.bookIds].sort();
    if ((await this.prisma.book.count({ where: { id: { in: bookIds } } })) !== bookIds.length) {
      throw new DomainError('VALIDATION_ERROR', 'Unknown book', { bookIds: 'Có sách không tồn tại' });
    }
    return this.prisma.$transaction(async (tx) => {
      const subscription = await this.subscriptions.findActiveForUpdate(tx, userId);
      if (!subscription || subscription.currentPeriodEnd <= new Date()) throw new DomainError('SUBSCRIPTION_INACTIVE');
      const open = await tx.loan.count({ where: { userId, status: { in: [...OPEN_LOAN_STATUSES] } } });
      if (open + bookIds.length > subscription.maxBooks) throw new DomainError('LOAN_LIMIT_EXCEEDED');

      const copyIds: string[] = [];
      for (const bookId of bookIds) {
        const copyId = await this.inventory.reserveCopy(tx, bookId);
        if (!copyId) throw new DomainError('NO_COPY_AVAILABLE', `No copy left for book ${bookId}`);
        copyIds.push(copyId);
      }
      const shipment = await this.shipments.create(tx, { type: 'LOAN_DELIVERY', fee: 0, addressSnapshot: address });
      const loans = await tx.loan.createManyAndReturn({
        data: copyIds.map((bookCopyId) => ({
          userId,
          subscriptionId: subscription.id,
          bookCopyId,
          deliveryShipmentId: shipment.id,
        })),
        select: { id: true },
      });
      return { loanIds: loans.map((loan) => loan.id), shipmentId: shipment.id };
    });
  }

  // spec §4.4: only the caller's ACTIVE loans, all or nothing; allowed after the subscription expired.
  async returnLoans(userId: string, input: ReturnInput): Promise<ReturnResult> {
    const address = await this.addresses.snapshotFor(userId, input.addressId);
    return this.prisma.$transaction(async (tx) => {
      const locked = await lockLoans(
        tx,
        Prisma.sql`id IN (${Prisma.join(input.loanIds)}) AND "userId" = ${userId} AND status = 'ACTIVE'`,
      );
      if (locked.length !== input.loanIds.length) throw new DomainError('LOAN_NOT_RETURNABLE');
      const shipment = await this.shipments.create(tx, { type: 'LOAN_PICKUP', fee: 0, addressSnapshot: address });
      await tx.loan.updateMany({
        where: { id: { in: locked.map((loan) => loan.id) } },
        data: { status: 'RETURN_REQUESTED', returnShipmentId: shipment.id },
      });
      return { shipmentId: shipment.id };
    });
  }

  async list(userId: string, page: number): Promise<Paged<LoanDto>> {
    const where = { userId };
    const [rows, total] = await Promise.all([
      this.prisma.loan.findMany({
        where,
        orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * LOAN_PAGE_SIZE,
        take: LOAN_PAGE_SIZE,
        include: { bookCopy: { select: { book: { select: { title: true, slug: true, coverUrl: true } } } } },
      }),
      this.prisma.loan.count({ where }),
    ]);
    // Shipments are read through their owner (spec §2.1), one query for the whole page.
    const statuses = await this.shipments.statusesOf(rows.map(trackedShipmentId));
    const items = rows.map((loan) => ({
      id: loan.id,
      status: loan.status,
      requestedAt: loan.requestedAt.toISOString(),
      deliveredAt: loan.deliveredAt?.toISOString() ?? null,
      returnedAt: loan.returnedAt?.toISOString() ?? null,
      book: loan.bookCopy.book,
      shipmentStatus: statuses.get(trackedShipmentId(loan))!,
    }));
    return { items, total, page, pageSize: LOAN_PAGE_SIZE };
  }
}
