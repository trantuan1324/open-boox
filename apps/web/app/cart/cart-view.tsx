'use client';

import { MAX_ORDER_QUANTITY } from '@open-boox/shared';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { removeBorrowLine } from '@/lib/cart/borrow-cart';
import { removeLine, setQuantity, subtotalOf } from '@/lib/cart/cart';
import { useBorrowCart } from '@/lib/cart/use-borrow-cart';
import { useCart } from '@/lib/cart/use-cart';
import { formatVnd } from '@/lib/format';

const row = 'flex flex-wrap items-center justify-between gap-[12px] rounded-[12px] border border-dashed border-cork-border p-[18px]';
const next = 'self-start rounded-[36px] bg-bark-brown px-6 py-3.5 text-[14px] font-medium uppercase leading-none';

export function CartView() {
  const buy = useCart();
  const borrow = useBorrowCart();
  if (!buy.ready || !borrow.ready) return null;

  if (buy.lines.length === 0 && borrow.lines.length === 0) {
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
    <div className="flex flex-col gap-[41px]">
      {buy.lines.length > 0 && (
        <section className="flex flex-col gap-[24px]">
          <h2 className="text-[18px] font-medium uppercase">Mua</h2>
          <ul className="flex flex-col gap-[12px]">
            {buy.lines.map((line) => (
              <li key={line.bookId} className={row}>
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
                    onClick={() => buy.update((ls) => setQuantity(ls, line.bookId, line.quantity - 1))}
                  >
                    −
                  </Button>
                  <span className="min-w-[24px] text-center text-[16px]">{line.quantity}</span>
                  <Button
                    variant="ghost"
                    aria-label={`Tăng số lượng ${line.title}`}
                    disabled={line.quantity >= MAX_ORDER_QUANTITY}
                    onClick={() => buy.update((ls) => setQuantity(ls, line.bookId, line.quantity + 1))}
                  >
                    +
                  </Button>
                  <Button variant="ghost" onClick={() => buy.update((ls) => removeLine(ls, line.bookId))}>
                    Xóa
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <p className="text-[18px]">Tạm tính: {formatVnd(subtotalOf(buy.lines))}</p>
          <p className="text-[14px]">Giá và phí giao hàng được tính lại khi đặt hàng.</p>
          <Link href="/checkout" className={next}>
            Tiếp tục
          </Link>
        </section>
      )}
      {borrow.lines.length > 0 && (
        <section className="flex flex-col gap-[24px]">
          <h2 className="text-[18px] font-medium uppercase">Mượn</h2>
          <ul className="flex flex-col gap-[12px]">
            {borrow.lines.map((line) => (
              <li key={line.bookId} className={row}>
                <Link href={`/books/${line.slug}`} className="text-[16px] font-medium uppercase">
                  {line.title}
                </Link>
                <Button variant="ghost" onClick={() => borrow.update((ls) => removeBorrowLine(ls, line.bookId))}>
                  Xóa
                </Button>
              </li>
            ))}
          </ul>
          <p className="text-[14px]">Mượn theo gói đăng ký, giao miễn phí, không hạn trả.</p>
          <Link href="/borrow/confirm" className={next}>
            Tiếp tục
          </Link>
        </section>
      )}
    </div>
  );
}
