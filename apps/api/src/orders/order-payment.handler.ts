import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { Payment, Prisma } from '@prisma/client';
import { InventoryService } from '../inventory/inventory.service';
import type { PaymentOutcomeHandler } from '../payments/payment-outcome';
import { PaymentsService } from '../payments/payments.service';
import { ShipmentsService } from '../shipments/shipments.service';

@Injectable()
export class OrderPaymentHandler implements PaymentOutcomeHandler, OnModuleInit {
  constructor(
    private readonly payments: PaymentsService,
    private readonly inventory: InventoryService,
    private readonly shipments: ShipmentsService,
  ) {}

  onModuleInit(): void {
    this.payments.registerHandler('order', this);
  }

  // A PENDING payment implies a PENDING_PAYMENT order: orders are only cancelled through settle(FAILED).
  // settle calls this once per payment, so exactly one ORDER_DELIVERY is created (spec §4.5).
  async onSucceeded(tx: Prisma.TransactionClient, payment: Payment): Promise<void> {
    const order = await tx.order.update({
      where: { id: payment.orderId! },
      data: { status: 'PAID' },
      select: { id: true, shippingFee: true, addressSnapshot: true },
    });
    await this.shipments.create(tx, {
      type: 'ORDER_DELIVERY',
      orderId: order.id,
      fee: order.shippingFee,
      addressSnapshot: order.addressSnapshot as Prisma.InputJsonValue,
    });
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
