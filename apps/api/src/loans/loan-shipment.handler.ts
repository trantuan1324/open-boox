import { Injectable, type OnModuleInit } from '@nestjs/common';
import { Prisma, type Shipment } from '@prisma/client';
import { DomainError } from '../common/errors/domain-error';
import { InventoryService } from '../inventory/inventory.service';
import type { ShipmentStatusHandler } from '../shipments/shipment-status';
import { ShipmentsService } from '../shipments/shipments.service';
import { lockLoans, moveLockedCopies } from './lock-loans';

@Injectable()
export class LoanShipmentHandler implements ShipmentStatusHandler, OnModuleInit {
  constructor(
    private readonly shipments: ShipmentsService,
    private readonly inventory: InventoryService,
  ) {}

  onModuleInit(): void {
    this.shipments.registerHandler('LOAN_DELIVERY', this);
    this.shipments.registerHandler('LOAN_PICKUP', this);
  }

  // spec §4.4a: only DELIVERED does anything — the books reached the customer, or came back to the store.
  // Status guards in the lock condition make a repeat a no-op.
  async onStatusChanged(tx: Prisma.TransactionClient, shipment: Shipment): Promise<void> {
    if (shipment.status !== 'DELIVERED') return;
    const now = new Date();
    if (shipment.type === 'LOAN_DELIVERY') {
      const locked = await lockLoans(tx, Prisma.sql`"deliveryShipmentId" = ${shipment.id} AND status = 'REQUESTED'`);
      await tx.loan.updateMany({ where: { id: { in: locked.map((l) => l.id) } }, data: { status: 'ACTIVE', deliveredAt: now } });
      await moveLockedCopies(this.inventory, tx, locked, 'RESERVED', 'ON_LOAN');
      return;
    }
    const locked = await lockLoans(tx, Prisma.sql`"returnShipmentId" = ${shipment.id} AND status = 'RETURN_REQUESTED'`);
    await tx.loan.updateMany({ where: { id: { in: locked.map((l) => l.id) } }, data: { status: 'RETURNED', returnedAt: now } });
    await moveLockedCopies(this.inventory, tx, locked, 'ON_LOAN', 'AVAILABLE');
  }

  // spec §4.6: re-point the loans to the retry. None left means they were cancelled: refuse, which rolls the
  // new shipment back instead of leaving it orphaned.
  async onRetried(tx: Prisma.TransactionClient, failed: Shipment, created: Shipment): Promise<void> {
    const delivery = failed.type === 'LOAN_DELIVERY';
    const locked = delivery
      ? await lockLoans(tx, Prisma.sql`"deliveryShipmentId" = ${failed.id} AND status = 'REQUESTED'`)
      : await lockLoans(tx, Prisma.sql`"returnShipmentId" = ${failed.id} AND status = 'RETURN_REQUESTED'`);
    if (locked.length === 0) throw new DomainError('INVALID_SHIPMENT_TRANSITION', 'The loans of this shipment were cancelled');
    await tx.loan.updateMany({
      where: { id: { in: locked.map((l) => l.id) } },
      data: delivery ? { deliveryShipmentId: created.id } : { returnShipmentId: created.id },
    });
  }
}
