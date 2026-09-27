import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { OrderStatus, Prisma, Shipment, ShipmentStatus } from '@prisma/client';
import type { ShipmentStatusHandler } from '../shipments/shipment-status';
import { ShipmentsService } from '../shipments/shipments.service';

// spec §4.5: PICKED_UP → order SHIPPING, DELIVERED → order DELIVERED. The `from` guard makes a retried
// shipment's PICKED_UP a no-op when the order is already SHIPPING; FAILED leaves the order as it is.
const ORDER_STEP: Partial<Record<ShipmentStatus, { from: OrderStatus; to: OrderStatus }>> = {
  PICKED_UP: { from: 'PAID', to: 'SHIPPING' },
  DELIVERED: { from: 'SHIPPING', to: 'DELIVERED' },
};

@Injectable()
export class OrderShipmentHandler implements ShipmentStatusHandler, OnModuleInit {
  constructor(private readonly shipments: ShipmentsService) {}

  onModuleInit(): void {
    this.shipments.registerHandler('ORDER_DELIVERY', this);
  }

  async onStatusChanged(tx: Prisma.TransactionClient, shipment: Shipment): Promise<void> {
    const step = ORDER_STEP[shipment.status];
    if (!step) return;
    await tx.order.updateMany({ where: { id: shipment.orderId!, status: step.from }, data: { status: step.to } });
  }
}
