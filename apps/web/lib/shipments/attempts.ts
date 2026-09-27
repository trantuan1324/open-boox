import type { ShipmentDto } from '@open-boox/shared';

// The API lists shipments oldest first; pages show the newest attempt on top, numbered from the first.
export function deliveryAttempts(shipments: ShipmentDto[]): Array<{ number: number; shipment: ShipmentDto }> {
  return shipments.map((shipment, i) => ({ number: i + 1, shipment })).reverse();
}
