import { Injectable } from '@nestjs/common';
import { type LoanStatus, Prisma } from '@prisma/client';
import {
  ADMIN_LOAN_PAGE_SIZE,
  type AdminLoanListQuery,
  type AdminLoanRow,
  type AdminShipmentDetail,
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
import { lockLoans, moveLockedCopies } from './lock-loans';

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
        if (!copyId) {
          // Name the book, so the customer knows which one to drop from a multi-book cart.
          const { title } = await tx.book.findUniqueOrThrow({ where: { id: bookId }, select: { title: true } });
          throw new DomainError('NO_COPY_AVAILABLE', `No copy left for book ${bookId}`, {
            bookIds: `"${title}" đã hết bản cho mượn`,
          });
        }
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

  // spec §4.6 cancel-loans. Cancel and retry exclude each other through the loan row locks; with nothing left
  // to cancel the answer depends on why: a retry took the loans (409) or they were cancelled before (200).
  // "Every loan is CANCELLED" is not the test — after a retry the old shipment has no loans, so it would be
  // vacuously true.
  async cancelLoans(shipmentId: string): Promise<AdminShipmentDetail> {
    await this.prisma.$transaction(async (tx) => {
      const shipment = await this.shipments.findForLoans(tx, shipmentId);
      if (!shipment) throw new DomainError('NOT_FOUND');
      if (shipment.type !== 'LOAN_DELIVERY' || shipment.status !== 'FAILED') throw new DomainError('LOAN_NOT_CANCELLABLE');
      const locked = await lockLoans(tx, Prisma.sql`"deliveryShipmentId" = ${shipmentId} AND status = 'REQUESTED'`);
      if (locked.length === 0) {
        // Re-read after the lock wait: a retry that committed meanwhile is visible to this new statement.
        const now = await this.shipments.findForLoans(tx, shipmentId);
        if (now!.retriedById) throw new DomainError('LOAN_NOT_CANCELLABLE');
        return;
      }
      await tx.loan.updateMany({ where: { id: { in: locked.map((l) => l.id) } }, data: { status: 'CANCELLED' } });
      await moveLockedCopies(this.inventory, tx, locked, 'RESERVED', 'AVAILABLE');
    });
    return this.shipments.adminGet(shipmentId);
  }

  async adminList({ status, shipmentId, page }: AdminLoanListQuery): Promise<Paged<AdminLoanRow>> {
    const where: Prisma.LoanWhereInput = {
      status,
      ...(shipmentId && { OR: [{ deliveryShipmentId: shipmentId }, { returnShipmentId: shipmentId }] }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.loan.findMany({
        where,
        orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * ADMIN_LOAN_PAGE_SIZE,
        take: ADMIN_LOAN_PAGE_SIZE,
        include: {
          user: { select: { email: true } },
          bookCopy: { select: { barcode: true, book: { select: { title: true } } } },
        },
      }),
      this.prisma.loan.count({ where }),
    ]);
    const items = rows.map((loan) => ({
      id: loan.id,
      customerEmail: loan.user.email,
      bookTitle: loan.bookCopy.book.title,
      barcode: loan.bookCopy.barcode,
      status: loan.status,
      requestedAt: loan.requestedAt.toISOString(),
      deliveryShipmentId: loan.deliveryShipmentId,
      returnShipmentId: loan.returnShipmentId,
    }));
    return { items, total, page, pageSize: ADMIN_LOAN_PAGE_SIZE };
  }
}
