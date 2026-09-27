'use client';

import { MAX_ORDER_QUANTITY } from '@open-boox/shared';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { removeLine, setQuantity, subtotalOf } from '@/lib/cart/cart';
import { useCart } from '@/lib/cart/use-cart';
import { formatVnd } from '@/lib/format';

export function CartView() {
  const { lines, ready, update } = useCart();
  if (!ready) return null;

  if (lines.length === 0) {
    return (
      <div className="flex flex-col gap-[12px] rounded-[12px] border border-dashed border-cork-border p-[24px]">
        <p className="text-[16px]">Giỏ hàng đang trống.</p>
        <Link href="/books" className="self-start text-[12px] font-medium uppercase underline">
          Xem sách
        </Link>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-[24px]">
      <h2 className="text-[18px] font-medium uppercase">Mua</h2>
      <ul className="flex flex-col gap-[12px]">
        {lines.map((line) => (
          <li
            key={line.bookId}
            className="flex flex-wrap items-center justify-between gap-[12px] rounded-[12px] border border-dashed border-cork-border p-[18px]"
          >
            <div className="flex flex-col gap-[4px]">
              <Link href={`/books/${line.slug}`} className="text-[16px] font-medium uppercase">
                {line.title}
              </Link>
              <p className="text-[14px]">{formatVnd(line.salePrice)}</p>
            </div>
            <div className="flex items-center gap-[12px]">
              <Button
                variant="ghost"
                aria-label={`Giảm số lượng ${line.title}`}
                onClick={() => update((ls) => setQuantity(ls, line.bookId, line.quantity - 1))}
              >
                −
              </Button>
              <span className="min-w-[24px] text-center text-[16px]">{line.quantity}</span>
              <Button
                variant="ghost"
                aria-label={`Tăng số lượng ${line.title}`}
                disabled={line.quantity >= MAX_ORDER_QUANTITY}
                onClick={() => update((ls) => setQuantity(ls, line.bookId, line.quantity + 1))}
              >
                +
              </Button>
              <Button variant="ghost" onClick={() => update((ls) => removeLine(ls, line.bookId))}>
                Xóa
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-[18px]">Tạm tính: {formatVnd(subtotalOf(lines))}</p>
      <p className="text-[14px]">Giá và phí giao hàng được tính lại khi đặt hàng.</p>
      <Link
        href="/checkout"
        className="self-start rounded-[36px] bg-bark-brown px-6 py-3.5 text-[14px] font-medium uppercase leading-none"
      >
        Tiếp tục
      </Link>
    </section>
  );
}
