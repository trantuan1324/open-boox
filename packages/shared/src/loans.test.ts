import { describe, expect, it } from 'vitest';
import { adminLoanListQuerySchema, borrowInputSchema, loanListQuerySchema, returnInputSchema } from './loans';

const ids = (n: number, prefix = 'b') => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

describe('borrowInputSchema', () => {
  it('accepts 1–5 distinct books and an address', () => {
    expect(borrowInputSchema.safeParse({ bookIds: ids(5), addressId: 'a1' }).success).toBe(true);
    expect(borrowInputSchema.safeParse({ bookIds: ids(1), addressId: 'a1' }).success).toBe(true);
  });

  it.each([
    ['no books', { bookIds: [], addressId: 'a1' }],
    ['6 books', { bookIds: ids(6), addressId: 'a1' }],
    ['the same book twice', { bookIds: ['b1', 'b1'], addressId: 'a1' }],
    ['no address', { bookIds: ['b1'] }],
    ['an empty id', { bookIds: [''], addressId: 'a1' }],
  ])('rejects %s', (_label, input) => {
    expect(borrowInputSchema.safeParse(input).success).toBe(false);
  });
});

describe('returnInputSchema', () => {
  it('accepts up to 10 distinct loans', () => {
    expect(returnInputSchema.safeParse({ loanIds: ids(10, 'l'), addressId: 'a1' }).success).toBe(true);
  });

  it.each([
    ['no loans', { loanIds: [], addressId: 'a1' }],
    ['11 loans', { loanIds: ids(11, 'l'), addressId: 'a1' }],
    ['the same loan twice', { loanIds: ['l1', 'l1'], addressId: 'a1' }],
  ])('rejects %s', (_label, input) => {
    expect(returnInputSchema.safeParse(input).success).toBe(false);
  });
});

describe('list queries', () => {
  it('falls back to page 1', () => {
    expect(loanListQuerySchema.parse({ page: 'abc' })).toEqual({ page: 1 });
  });

  it('keeps a valid admin filter and drops hand-edited values', () => {
    expect(adminLoanListQuerySchema.parse({ status: 'ACTIVE', shipmentId: ' s1 ', page: '2' })).toEqual({
      status: 'ACTIVE',
      shipmentId: 's1',
      page: 2,
    });
    expect(adminLoanListQuerySchema.parse({ status: 'active', shipmentId: '', page: '-1' })).toEqual({
      status: undefined,
      shipmentId: undefined,
      page: 1,
    });
  });
});
