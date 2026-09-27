import { describe, expect, it } from 'vitest';
import { addLine, cartCount, type CartLine, parseCart, removeLine, setQuantity, subtotalOf } from './cart';

const book = { bookId: 'b1', slug: 'a', title: 'A', coverUrl: null, salePrice: 100_000 };
const line = (bookId: string, quantity: number, salePrice = 100_000): CartLine => ({ ...book, bookId, quantity, salePrice });

describe('parseCart', () => {
  it('reads a valid cart', () => {
    expect(parseCart(JSON.stringify([line('b1', 2)]))).toEqual([line('b1', 2)]);
  });

  it.each([null, '', 'not json', '{"a":1}', JSON.stringify([{ bookId: 'b1' }]), JSON.stringify([line('b1', 0)]), JSON.stringify([line('b1', 11)])])(
    'treats %j as an empty cart',
    (raw) => {
      expect(parseCart(raw)).toEqual([]);
    },
  );
});

describe('addLine', () => {
  it('adds a new book with quantity 1', () => {
    expect(addLine([], book)).toEqual([line('b1', 1)]);
  });

  it('adds up an existing book, capped at 10, and refreshes its price', () => {
    expect(addLine([line('b1', 2, 90_000)], book)).toEqual([line('b1', 3)]);
    expect(addLine([line('b1', 10)], book)).toEqual([line('b1', 10)]);
  });
});

describe('setQuantity / removeLine', () => {
  it('sets a quantity capped at 10 and removes the line at 0', () => {
    const lines = [line('b1', 1), line('b2', 1)];
    expect(setQuantity(lines, 'b1', 15)).toEqual([line('b1', 10), line('b2', 1)]);
    expect(setQuantity(lines, 'b1', 0)).toEqual([line('b2', 1)]);
    expect(removeLine(lines, 'b2')).toEqual([line('b1', 1)]);
  });
});

describe('cartCount / subtotalOf', () => {
  it('sums quantities and prices', () => {
    const lines = [line('b1', 2, 100_000), line('b2', 1, 45_000)];
    expect(cartCount(lines)).toBe(3);
    expect(subtotalOf(lines)).toBe(245_000);
  });
});
