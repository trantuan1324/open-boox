import type { OrderQuote } from '@open-boox/shared';
import { describe, expect, it } from 'vitest';
import { quoteMatches } from './quote-match';

const line = (bookId: string, quantity: number) => ({
  bookId,
  title: bookId,
  slug: bookId,
  unitPrice: 1000,
  quantity,
  lineTotal: 1000 * quantity,
});
const quote: OrderQuote = { items: [line('a', 1), line('b', 2)], subtotal: 5000, shippingFee: 20_000, total: 25_000 };

describe('quoteMatches', () => {
  it('accepts a quote for exactly these lines', () => {
    expect(quoteMatches(quote, [{ bookId: 'a', quantity: 1 }, { bookId: 'b', quantity: 2 }])).toBe(true);
  });

  it('rejects a stale quote after the cart changed in another tab', () => {
    expect(quoteMatches(quote, [{ bookId: 'a', quantity: 1 }, { bookId: 'b', quantity: 2 }, { bookId: 'c', quantity: 1 }])).toBe(false);
    expect(quoteMatches(quote, [{ bookId: 'a', quantity: 1 }])).toBe(false);
    expect(quoteMatches(quote, [{ bookId: 'a', quantity: 1 }, { bookId: 'b', quantity: 3 }])).toBe(false);
    expect(quoteMatches(quote, [{ bookId: 'b', quantity: 2 }, { bookId: 'a', quantity: 1 }])).toBe(false);
  });
});
