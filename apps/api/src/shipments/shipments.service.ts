import { Injectable } from '@nestjs/common';
import { Prisma, type Shipment, type ShipmentStatus, type ShipmentType } from '@prisma/client';
import {
  type AddressSnapshot,
  type AdminShipmentDetail,
  type AdminShipmentListQuery,
  type AdminShipmentRow,
  canTransition,
  type Paged,
  SHIPMENT_PAGE_SIZE,
  type ShipmentDto,
} from '@open-boox/shared';
import { DomainError } from '../common/errors/domain-error';
import { PrismaService } from '../prisma/prisma.service';
import type { ShipmentStatusHandler } from './shipment-status';

const WITH_EVENTS = {
  events: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
  retriedBy: { select: { id: true } },
} satisfies Prisma.ShipmentInclude;

type ShipmentWithEvents = Prisma.ShipmentGetPayload<{ include: typeof WITH_EVENTS }>;

function toDto(s: ShipmentWithEvents): ShipmentDto {
  return {
    id: s.id,
    type: s.type,
    status: s.status,
    fee: s.fee,
    createdAt: s.createdAt.toISOString(),
    retryOfId: s.retryOfId,
    retriedById: s.retriedBy?.id ?? null,
    events: s.events.map(({ status, note, createdAt }) => ({ status, note, createdAt: createdAt.toISOString() })),
  };
}

@Injectable()
export class ShipmentsService {
  private readonly handlers = new Map<ShipmentType, ShipmentStatusHandler>();

  constructor(private readonly prisma: PrismaService) {}

  registerHandler(type: ShipmentType, handler: ShipmentStatusHandler): void {
    if (this.handlers.has(type)) throw new Error(`Shipment status handler for "${type}" is already registered`);
    this.handlers.set(type, handler);
  }

  // Every shipment starts with a PENDING event so the timeline has its first point (spec §3.6).
  create(
    tx: Prisma.TransactionClient,
    data: { type: ShipmentType; orderId?: string; fee: number; addressSnapshot: Prisma.InputJsonValue; retryOfId?: string },
  ): Promise<Shipment> {
    if (data.type === 'ORDER_DELIVERY' && !data.orderId) throw new Error('An ORDER_DELIVERY shipment needs an orderId');
    return tx.shipment.create({ data: { ...data, events: { create: { status: 'PENDING' } } } });
  }

  // spec §4.6: same status → no-op 200; illegal → 409; otherwise a conditional update (CAS, like payments)
  // decides the single winner, and only the winner writes the event and calls the handler.
  async transition(id: string, status: ShipmentStatus, note?: string): Promise<AdminShipmentDetail> {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.shipment.findUnique({ where: { id }, select: { status: true } });
      if (!current) throw new DomainError('NOT_FOUND');
      if (current.status === status) return;
      if (!canTransition(current.status, status)) throw new DomainError('INVALID_SHIPMENT_TRANSITION');

      const { count } = await tx.shipment.updateMany({ where: { id, status: current.status }, data: { status } });
      if (count === 0) {
        // Another admin moved it first: fine if they reached the same status, a conflict otherwise.
        const now = await tx.shipment.findUniqueOrThrow({ where: { id }, select: { status: true } });
        if (now.status === status) return;
        throw new DomainError('INVALID_SHIPMENT_TRANSITION');
      }

      await tx.shipmentEvent.create({ data: { shipmentId: id, status, note } });
      const shipment = await tx.shipment.findUniqueOrThrow({ where: { id } });
      const handler = this.handlers.get(shipment.type);
      // A missing registration must not let a status change silently: 500 and the transaction rolls back.
      if (!handler) throw new Error(`No shipment status handler registered for "${shipment.type}"`);
      await handler.onStatusChanged(tx, shipment);
    });
    return this.adminGet(id);
  }

  // spec §4.6: only a FAILED shipment; the unique retryOfId lets one retry win. P2002 aborts the Postgres
  // transaction, so it is mapped here, outside $transaction.
  async retry(id: string): Promise<AdminShipmentDetail> {
    let created: Shipment;
    try {
      created = await this.prisma.$transaction(async (tx) => {
        const failed = await tx.shipment.findUnique({ where: { id } });
        if (!failed) throw new DomainError('NOT_FOUND');
        if (failed.status !== 'FAILED') throw new DomainError('INVALID_SHIPMENT_TRANSITION');
        return this.create(tx, {
          type: failed.type,
          orderId: failed.orderId ?? undefined,
          fee: failed.fee,
          addressSnapshot: failed.addressSnapshot as Prisma.InputJsonValue,
          retryOfId: failed.id,
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new DomainError('SHIPMENT_ALREADY_RETRIED');
      }
      throw error;
    }
    return this.adminGet(created.id);
  }

  async listForOrder(db: Prisma.TransactionClient, orderId: string): Promise<ShipmentDto[]> {
    const rows = await db.shipment.findMany({
      where: { orderId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: WITH_EVENTS,
    });
    return rows.map(toDto);
  }

  // The newest shipment's status per order ("current shipment", spec §3.6); orders without one are absent.
  async latestStatuses(orderIds: string[]): Promise<Map<string, ShipmentStatus>> {
    const rows = await this.prisma.shipment.findMany({
      where: { orderId: { in: orderIds } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { orderId: true, status: true },
    });
    const latest = new Map<string, ShipmentStatus>();
    for (const row of rows) if (row.orderId && !latest.has(row.orderId)) latest.set(row.orderId, row.status);
    return latest;
  }

  async adminList({ status, type, page }: AdminShipmentListQuery): Promise<Paged<AdminShipmentRow>> {
    const where: Prisma.ShipmentWhereInput = { status, type };
    const [rows, total] = await Promise.all([
      this.prisma.shipment.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * SHIPMENT_PAGE_SIZE,
        take: SHIPMENT_PAGE_SIZE,
        include: { retriedBy: { select: { id: true } } },
      }),
      this.prisma.shipment.count({ where }),
    ]);
    const items = rows.map((s) => ({
      id: s.id,
      type: s.type,
      status: s.status,
      orderId: s.orderId,
      fee: s.fee,
      createdAt: s.createdAt.toISOString(),
      retriedById: s.retriedBy?.id ?? null,
    }));
    return { items, total, page, pageSize: SHIPMENT_PAGE_SIZE };
  }

  async adminGet(id: string): Promise<AdminShipmentDetail> {
    const shipment = await this.prisma.shipment.findUnique({ where: { id }, include: WITH_EVENTS });
    if (!shipment) throw new DomainError('NOT_FOUND');
    return {
      ...toDto(shipment),
      orderId: shipment.orderId,
      address: shipment.addressSnapshot as unknown as AddressSnapshot,
    };
  }
}
