import { z } from 'zod';
import type { AddressSnapshot } from './address';

export const SHIPMENT_PAGE_SIZE = 20;
export const SHIPMENT_NOTE_MAX = 500;

export const SHIPMENT_STATUSES = ['PENDING', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'FAILED'] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const SHIPMENT_TYPES = ['ORDER_DELIVERY', 'LOAN_DELIVERY', 'LOAN_PICKUP'] as const;
export type ShipmentType = (typeof SHIPMENT_TYPES)[number];

// spec §4.6: no skipping; DELIVERED and FAILED are final. Same-status requests are a no-op handled by the
// API before this check, so they are not listed here.
export const NEXT_SHIPMENT_STATUSES: Record<ShipmentStatus, readonly ShipmentStatus[]> = {
  PENDING: ['PICKED_UP', 'FAILED'],
  PICKED_UP: ['IN_TRANSIT', 'FAILED'],
  IN_TRANSIT: ['DELIVERED', 'FAILED'],
  DELIVERED: [],
  FAILED: [],
};

export function canTransition(from: ShipmentStatus, to: ShipmentStatus): boolean {
  return NEXT_SHIPMENT_STATUSES[from].includes(to);
}

const blankToUndefined = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? undefined : value);

export const shipmentTransitionSchema = z.object({
  status: z.enum(SHIPMENT_STATUSES, { error: 'Trạng thái không hợp lệ' }),
  note: z.preprocess(
    blankToUndefined,
    z.string().trim().max(SHIPMENT_NOTE_MAX, `Ghi chú tối đa ${SHIPMENT_NOTE_MAX} ký tự`).optional(),
  ),
});
export type ShipmentTransitionInput = z.output<typeof shipmentTransitionSchema>;

// Query strings may repeat a key (?status=a&status=b); keep the first value.
const first = (value: unknown) => (Array.isArray(value) ? value[0] : value);

// Lenient like the catalog query: a hand-edited URL falls back to defaults instead of an error page.
export const adminShipmentListQuerySchema = z.object({
  status: z.preprocess(first, z.enum(SHIPMENT_STATUSES).optional().catch(undefined)),
  type: z.preprocess(first, z.enum(SHIPMENT_TYPES).optional().catch(undefined)),
  page: z.preprocess(first, z.coerce.number().int().min(1).max(1000).catch(1)),
});
export type AdminShipmentListQuery = z.output<typeof adminShipmentListQuerySchema>;

export interface ShipmentEventDto {
  status: ShipmentStatus;
  note: string | null;
  createdAt: string;
}

export interface ShipmentDto {
  id: string;
  type: ShipmentType;
  status: ShipmentStatus;
  fee: number;
  createdAt: string;
  retryOfId: string | null;
  retriedById: string | null;
  events: ShipmentEventDto[];
}

export interface AdminShipmentRow {
  id: string;
  type: ShipmentType;
  status: ShipmentStatus;
  orderId: string | null;
  fee: number;
  createdAt: string;
  retriedById: string | null;
}

export interface AdminShipmentDetail extends ShipmentDto {
  orderId: string | null;
  address: AddressSnapshot;
}
