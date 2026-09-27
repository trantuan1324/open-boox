import { describe, expect, it } from 'vitest';
import {
  adminShipmentListQuerySchema,
  canTransition,
  SHIPMENT_STATUSES,
  type ShipmentStatus,
  shipmentTransitionSchema,
} from './shipments';

const ALLOWED: Array<[ShipmentStatus, ShipmentStatus]> = [
  ['PENDING', 'PICKED_UP'],
  ['PENDING', 'FAILED'],
  ['PICKED_UP', 'IN_TRANSIT'],
  ['PICKED_UP', 'FAILED'],
  ['IN_TRANSIT', 'DELIVERED'],
  ['IN_TRANSIT', 'FAILED'],
];

describe('canTransition', () => {
  // The full 5×5 matrix: exactly the six pairs above are allowed, everything else (same status, skips,
  // going back, leaving a final state) is not.
  for (const from of SHIPMENT_STATUSES) {
    for (const to of SHIPMENT_STATUSES) {
      const expected = ALLOWED.some(([f, t]) => f === from && t === to);
      it(`${from} → ${to}: ${expected}`, () => {
        expect(canTransition(from, to)).toBe(expected);
      });
    }
  }
});

describe('shipmentTransitionSchema', () => {
  it('accepts a status alone', () => {
    expect(shipmentTransitionSchema.parse({ status: 'PICKED_UP' })).toEqual({ status: 'PICKED_UP' });
  });

  it('trims the note and drops a blank one', () => {
    expect(shipmentTransitionSchema.parse({ status: 'FAILED', note: '  Khách không nghe máy \n' }).note).toBe(
      'Khách không nghe máy',
    );
    expect(shipmentTransitionSchema.parse({ status: 'FAILED', note: '   ' }).note).toBeUndefined();
  });

  it('rejects an unknown status and a note over 500 characters', () => {
    expect(shipmentTransitionSchema.safeParse({ status: 'LOST' }).success).toBe(false);
    expect(shipmentTransitionSchema.safeParse({ status: 'FAILED', note: 'x'.repeat(501) }).success).toBe(false);
    expect(shipmentTransitionSchema.safeParse({ status: 'FAILED', note: 'x'.repeat(500) }).success).toBe(true);
  });
});

describe('adminShipmentListQuerySchema', () => {
  it('keeps valid filters', () => {
    expect(adminShipmentListQuerySchema.parse({ status: 'FAILED', type: 'ORDER_DELIVERY', page: '2' })).toEqual({
      status: 'FAILED',
      type: 'ORDER_DELIVERY',
      page: 2,
    });
  });

  it('falls back to defaults for hand-edited values', () => {
    expect(adminShipmentListQuerySchema.parse({ status: 'abc', type: '', page: '-3' })).toEqual({
      status: undefined,
      type: undefined,
      page: 1,
    });
    expect(adminShipmentListQuerySchema.parse({ status: ['FAILED', 'PENDING'] }).status).toBe('FAILED');
  });
});
