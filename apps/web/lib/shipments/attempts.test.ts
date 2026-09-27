import type { ShipmentDto } from '@open-boox/shared';
import { describe, expect, it } from 'vitest';
import { deliveryAttempts } from './attempts';

const shipment = (id: string, status: ShipmentDto['status']): ShipmentDto => ({
  id,
  type: 'ORDER_DELIVERY',
  status,
  fee: 20_000,
  createdAt: '2026-09-27T00:00:00.000Z',
  retryOfId: null,
  retriedById: null,
  events: [],
});

describe('deliveryAttempts', () => {
  it('numbers attempts in creation order and lists the newest first', () => {
    const input = [shipment('a', 'FAILED'), shipment('b', 'FAILED'), shipment('c', 'PICKED_UP')];
    expect(deliveryAttempts(input).map(({ number, shipment: s }) => [number, s.id])).toEqual([
      [3, 'c'],
      [2, 'b'],
      [1, 'a'],
    ]);
    expect(input.map((s) => s.id)).toEqual(['a', 'b', 'c']); // input untouched
  });

  it('returns nothing for an order without shipments', () => {
    expect(deliveryAttempts([])).toEqual([]);
  });
});
