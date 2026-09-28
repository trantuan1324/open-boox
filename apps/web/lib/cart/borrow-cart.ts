import { LOANS_PER_BORROW_MAX } from '@open-boox/shared';
import { z } from 'zod';

export const BORROW_CART_KEY = 'ob.cart.borrow';

const lineSchema = z.object({
  bookId: z.string().min(1),
  slug: z.string(),
  title: z.string(),
  coverUrl: z.string().nullable(),
});
export type BorrowLine = z.infer<typeof lineSchema>;

const cartSchema = z
  .array(lineSchema)
  .max(LOANS_PER_BORROW_MAX)
  .refine((lines) => new Set(lines.map((l) => l.bookId)).size === lines.length);

// Anything unreadable (hand-edited, older format, too many lines) resets the cart instead of breaking the page.
export function parseBorrowCart(raw: string | null): BorrowLine[] {
  if (!raw) return [];
  try {
    const result = cartSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}

export function borrowAddState(lines: BorrowLine[], bookId: string): 'can-add' | 'in-cart' | 'full' {
  if (lines.some((line) => line.bookId === bookId)) return 'in-cart';
  return lines.length >= LOANS_PER_BORROW_MAX ? 'full' : 'can-add';
}

export function addBorrowLine(lines: BorrowLine[], book: BorrowLine): BorrowLine[] {
  return borrowAddState(lines, book.bookId) === 'can-add' ? [...lines, book] : lines;
}

export function removeBorrowLine(lines: BorrowLine[], bookId: string): BorrowLine[] {
  return lines.filter((line) => line.bookId !== bookId);
}
