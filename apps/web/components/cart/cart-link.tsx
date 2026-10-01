'use client';

import Link from 'next/link';
import { cartCount } from '@/lib/cart/cart';
import { useBorrowCart } from '@/lib/cart/use-borrow-cart';
import { useCart } from '@/lib/cart/use-cart';

export function CartLink() {
  const { lines } = useCart();
  const { lines: borrowLines } = useBorrowCart();
  const count = cartCount(lines) + borrowLines.length;
  return (
    <Link
      href="/cart"
      className="rounded-full border border-ink bg-paper px-[18px] py-[13px] text-[13px] font-bold uppercase leading-none tracking-[0.03em] text-ink transition-all duration-500 ease-bounce hover:bg-ink hover:text-paper"
    >
      Giỏ ({count})
    </Link>
  );
}
