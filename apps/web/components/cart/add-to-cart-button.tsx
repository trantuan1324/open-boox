'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { addLine, type CartLine } from '@/lib/cart/cart';
import { useCart } from '@/lib/cart/use-cart';

export function AddToCartButton({ book }: { book: Omit<CartLine, 'quantity'> }) {
  const { update } = useCart();
  const [added, setAdded] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-[12px]">
      <Button
        onClick={() => {
          update((lines) => addLine(lines, book));
          setAdded(true);
        }}
      >
        Thêm vào giỏ
      </Button>
      {added && (
        <p role="status" className="text-[14px]">
          Đã thêm vào giỏ ·{' '}
          <Link href="/cart" className="font-medium uppercase underline">
            Xem giỏ
          </Link>
        </p>
      )}
    </div>
  );
}
