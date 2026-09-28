'use client';

import Link from 'next/link';
import { cartCount } from '@/lib/cart/cart';
import { useBorrowCart } from '@/lib/cart/use-borrow-cart';
import { useCart } from '@/lib/cart/use-cart';

export function CartLink() {
  const { lines } = useCart();
  const { lines: borrowLines } = useBorrowCart();
  const count = cartCount(lines) + borrowLines.length;
  return <Link href="/cart">Giỏ hàng{count > 0 ? ` (${count})` : ''}</Link>;
}
