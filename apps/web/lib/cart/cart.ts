import { MAX_ORDER_QUANTITY } from '@open-boox/shared';
import { z } from 'zod';

export const CART_KEY = 'ob.cart.buy';

// Prices here are display-only; the server re-prices everything at checkout (spec §3.4).
const lineSchema = z.object({
  bookId: z.string().min(1),
  slug: z.string(),
  title: z.string(),
  coverUrl: z.string().nullable(),
  salePrice: z.number().int().nonnegative(),
  quantity: z.number().int().min(1).max(MAX_ORDER_QUANTITY),
});
export type CartLine = z.infer<typeof lineSchema>;

// Anything unreadable (hand-edited, older format) resets the cart instead of breaking the page.
export function parseCart(raw: string | null): CartLine[] {
  if (!raw) return [];
  try {
    const result = z.array(lineSchema).safeParse(JSON.parse(raw));
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}

export function addLine(lines: CartLine[], book: Omit<CartLine, 'quantity'>): CartLine[] {
  const existing = lines.find((line) => line.bookId === book.bookId);
  if (!existing) return [...lines, { ...book, quantity: 1 }];
  return lines.map((line) =>
    line.bookId === book.bookId ? { ...book, quantity: Math.min(line.quantity + 1, MAX_ORDER_QUANTITY) } : line,
  );
}

export function setQuantity(lines: CartLine[], bookId: string, quantity: number): CartLine[] {
  if (quantity <= 0) return removeLine(lines, bookId);
  return lines.map((line) =>
    line.bookId === bookId ? { ...line, quantity: Math.min(quantity, MAX_ORDER_QUANTITY) } : line,
  );
}

export function removeLine(lines: CartLine[], bookId: string): CartLine[] {
  return lines.filter((line) => line.bookId !== bookId);
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function subtotalOf(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.salePrice * line.quantity, 0);
}
