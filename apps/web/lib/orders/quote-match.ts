import type { OrderItemInput, OrderQuote } from '@open-boox/shared';

// The cart can change in another tab while a quote is on screen; a quote for other lines must not be
// shown (its lines no longer line up by index) until the new one arrives.
export function quoteMatches(quote: OrderQuote, items: OrderItemInput[]): boolean {
  return (
    quote.items.length === items.length &&
    quote.items.every((line, i) => line.bookId === items[i]!.bookId && line.quantity === items[i]!.quantity)
  );
}
