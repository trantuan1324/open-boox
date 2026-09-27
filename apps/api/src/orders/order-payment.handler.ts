import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { Payment, Prisma } from '@prisma/client';
import { InventoryService } from '../inventory/inventory.service';
import type { PaymentOutcomeHandler } from '../payments/payment-outcome';
import { PaymentsService } from '../payments/payments.service';

@Injectable()
export class OrderPaymentHandler implements PaymentOutcomeHandler, OnModuleInit {
  constructor(
    private readonly payments: PaymentsService,
    private readonly inventory: InventoryService,
  ) {}

  onModuleInit(): void {
    this.payments.registerHandler('order', this);
  }

  // A PENDING payment implies a PENDING_PAYMENT order: orders are only cancelled through settle(FAILED).
  // M3 adds the ORDER_DELIVERY shipment here (spec §4.5).
  async onSucceeded(tx: Prisma.TransactionClient, payment: Payment): Promise<void> {
    await tx.order.update({ where: { id: payment.orderId! }, data: { status: 'PAID' } });
  }

  // The status guard makes the restock happen at most once per order.
  async onFailed(tx: Prisma.TransactionClient, payment: Payment): Promise<void> {
    const orderId = payment.orderId!;
    const { count } = await tx.order.updateMany({
      where: { id: orderId, status: 'PENDING_PAYMENT' },
      data: { status: 'CANCELLED' },
    });
    if (count === 0) return;
    const items = await tx.orderItem.findMany({ where: { orderId }, select: { bookId: true, quantity: true } });
    await this.inventory.returnStock(tx, items);
  }
}
