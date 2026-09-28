import { describe, expect, it } from 'vitest';
import { addBorrowLine, borrowAddState, type BorrowLine, parseBorrowCart, removeBorrowLine } from './borrow-cart';

const line = (bookId: string): BorrowLine => ({ bookId, slug: bookId, title: bookId.toUpperCase(), coverUrl: null });
const lines = (n: number) => Array.from({ length: n }, (_, i) => line(`b${i}`));

describe('parseBorrowCart', () => {
  it('reads a valid cart', () => {
    expect(parseBorrowCart(JSON.stringify(lines(2)))).toEqual(lines(2));
  });

  it.each([
    null,
    '',
    'not json',
    '{"a":1}',
    JSON.stringify([{ bookId: 'b1' }]),
    JSON.stringify(lines(6)), // more than LOANS_PER_BORROW_MAX, e.g. edited by hand
    JSON.stringify([line('b1'), line('b1')]),
  ])('treats %j as an empty cart', (raw) => {
    expect(parseBorrowCart(raw)).toEqual([]);
  });
});

describe('addBorrowLine / removeBorrowLine / borrowAddState', () => {
  it('adds a book once, and never beyond 5', () => {
    expect(addBorrowLine([], line('b1'))).toEqual([line('b1')]);
    expect(addBorrowLine([line('b1')], line('b1'))).toEqual([line('b1')]);
    expect(addBorrowLine(lines(5), line('x'))).toEqual(lines(5));
  });

  it('removes a book', () => {
    expect(removeBorrowLine(lines(2), 'b0')).toEqual([line('b1')]);
  });

  it('tells whether a book can still be added', () => {
    expect(borrowAddState([], 'b1')).toBe('can-add');
    expect(borrowAddState([line('b1')], 'b1')).toBe('in-cart');
    expect(borrowAddState(lines(5), 'x')).toBe('full');
    expect(borrowAddState(lines(5), 'b0')).toBe('in-cart');
  });
});
