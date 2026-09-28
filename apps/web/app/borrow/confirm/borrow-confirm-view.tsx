'use client';

import type { AddressDto, BorrowResult, ErrorCode } from '@open-boox/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AddressPicker, defaultAddressId } from '@/components/addresses/address-picker';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api/client';
import { ApiError } from '@/lib/api/error';
import { removeBorrowLine } from '@/lib/cart/borrow-cart';
import { useBorrowCart } from '@/lib/cart/use-borrow-cart';
import { messageFor } from '@/lib/errors/messages';

const box = 'flex flex-col gap-[18px] rounded-[12px] border border-dashed border-cork-border p-[24px]';

export function BorrowConfirmView({ addresses }: { addresses: AddressDto[] }) {
  const router = useRouter();
  const { lines, ready, update, clear } = useBorrowCart();
  const [addressId, setAddressId] = useState<string | null>(() => defaultAddressId(addresses));
  const [pending, setPending] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<{ code: ErrorCode; message: string } | null>(null);

  async function borrow() {
    if (!addressId) return;
    setPending(true);
    setError(null);
    try {
      await apiClient<BorrowResult>('/loans', { method: 'POST', body: { bookIds: lines.map((l) => l.bookId), addressId } });
      setRedirecting(true);
      clear();
      router.push('/account/loans');
    } catch (e) {
      const code = e instanceof ApiError ? e.code : 'INTERNAL_ERROR';
      // A stale cart (book deleted) comes back as a field message on bookIds.
      const message = (e instanceof ApiError && e.fields?.bookIds) || messageFor(code);
      setError({ code, message });
      setPending(false);
    }
  }

  if (!ready) return null;
  if (redirecting) return <p className="text-[16px]">Đang chuyển tới sách đang mượn…</p>;
  if (lines.length === 0) {
    return (
      <div className={box}>
        <p className="text-[16px]">Giỏ mượn đang trống.</p>
        <Link href="/books?availability=loan" className="self-start text-[12px] font-medium uppercase underline">
          Xem sách cho mượn
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[31px]">
      <section className={box}>
        <h2 className="text-[18px] font-medium uppercase">Giao tới</h2>
        <AddressPicker addresses={addresses} value={addressId} onChange={setAddressId} />
      </section>
      <section className={box}>
        <h2 className="text-[18px] font-medium uppercase">Sách mượn</h2>
        <ul className="flex flex-col gap-[12px]">
          {lines.map((line) => (
            <li key={line.bookId} className="flex flex-wrap items-center justify-between gap-[12px] text-[16px]">
              <span>{line.title}</span>
              <Button variant="ghost" onClick={() => update((ls) => removeBorrowLine(ls, line.bookId))}>
                Bỏ
              </Button>
            </li>
          ))}
        </ul>
        <p className="text-[14px]">Giao miễn phí. Không có hạn trả; trả sách ở trang Sách đang mượn.</p>
      </section>
      <section className={box}>
        {error && (
          <p role="alert" className="text-[14px] text-ember-accent">
            {error.message}{' '}
            {error.code === 'SUBSCRIPTION_INACTIVE' && (
              <Link href="/plans" className="font-medium uppercase underline">
                Xem các gói
              </Link>
            )}
          </p>
        )}
        <Button className="self-start" disabled={!addressId || pending} onClick={borrow}>
          Xác nhận mượn
        </Button>
      </section>
    </div>
  );
}
