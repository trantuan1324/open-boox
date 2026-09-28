'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { addBorrowLine, borrowAddState, type BorrowLine } from '@/lib/cart/borrow-cart';
import { useBorrowCart } from '@/lib/cart/use-borrow-cart';

const LABEL = { 'can-add': 'Thêm vào giỏ mượn', 'in-cart': 'Đã trong giỏ', full: 'Giỏ mượn đã đầy' } as const;

export function AddToBorrowButton({ book }: { book: BorrowLine }) {
  const { lines, ready, update } = useBorrowCart();
  if (!ready) return null;
  const state = borrowAddState(lines, book.bookId);
  return (
    <div className="flex flex-wrap items-center gap-[12px]">
      <Button variant="ghost" disabled={state !== 'can-add'} onClick={() => update((ls) => addBorrowLine(ls, book))}>
        {LABEL[state]}
      </Button>
      {state !== 'can-add' && (
        <Link href="/cart" className="text-[12px] font-medium uppercase underline">
          Xem giỏ
        </Link>
      )}
    </div>
  );
}
