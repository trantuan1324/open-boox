import type { Prisma, Shipment } from '@prisma/client';

// Implemented by the module that owns what a shipment carries (orders for ORDER_DELIVERY now, loans in M4)
// and registered with ShipmentsService.registerHandler in onModuleInit. Called only for the request that
// actually changed the status, inside its transaction; it must never write Shipment (spec §2.1, §4.6).
export interface ShipmentStatusHandler {
  onStatusChanged(tx: Prisma.TransactionClient, shipment: Shipment): Promise<void>;
}
