import type { Prisma, Shipment } from '@prisma/client';

// Implemented by the module that owns what a shipment carries (orders for ORDER_DELIVERY, loans for
// LOAN_DELIVERY/LOAN_PICKUP) and registered with ShipmentsService.registerHandler in onModuleInit. Called only
// for the request that actually changed the status, inside its transaction; it must never write Shipment
// (spec §2.1, §4.6).
export interface ShipmentStatusHandler {
  onStatusChanged(tx: Prisma.TransactionClient, shipment: Shipment): Promise<void>;
  // Optional: re-point whatever the failed shipment carried to its retry, inside the retry's transaction and
  // after the new shipment exists. Throwing (a DomainError) rolls the retry back (spec §4.6).
  onRetried?(tx: Prisma.TransactionClient, failed: Shipment, created: Shipment): Promise<void>;
}
