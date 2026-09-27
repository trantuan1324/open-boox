import { describe, expect, it } from 'vitest';
import { orderInputSchema, orderListQuerySchema } from './orders';

const item = (bookId: string, quantity = 1) => ({ bookId, quantity });

describe('orderInputSchema', () => {
  it('accepts 1–20 distinct books with quantity 1–10', () => {
    const items = Array.from({ length: 20 }, (_, i) => item(`b${i}`, 10));
    expect(orderInputSchema.safeParse({ items, addressId: 'a1' }).success).toBe(true);
  });

  it.each([
    ['no items', []],
    ['21 lines', Array.from({ length: 21 }, (_, i) => item(`b${i}`))],
    ['quantity 0', [item('b1', 0)]],
    ['quantity 11', [item('b1', 11)]],
    ['fractional quantity', [item('b1', 1.5)]],
    ['the same book twice', [item('b1'), item('b1', 2)]],
  ])('rejects %s', (_label, items) => {
    expect(orderInputSchema.safeParse({ items, addressId: 'a1' }).success).toBe(false);
  });

  it('requires an addressId', () => {
    expect(orderInputSchema.safeParse({ items: [item('b1')] }).success).toBe(false);
  });
});

describe('orderListQuerySchema', () => {
  it.each([
    [{}, 1],
    [{ page: '3' }, 3],
    [{ page: 'abc' }, 1],
    [{ page: '0' }, 1],
    [{ page: ['2', '5'] }, 2],
  ])('parses %j to page %i', (query, page) => {
    expect(orderListQuerySchema.parse(query)).toEqual({ page });
  });
});
