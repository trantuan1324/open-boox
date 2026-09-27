'use client';

import Link from 'next/link';
import { cartCount } from '@/lib/cart/cart';
import { useCart } from '@/lib/cart/use-cart';

export function CartLink() {
  const { lines } = useCart();
  const count = cartCount(lines);
  return <Link href="/cart">Giỏ hàng{count > 0 ? ` (${count})` : ''}</Link>;
}
