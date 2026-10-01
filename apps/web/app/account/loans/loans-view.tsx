'use client';

import { type AddressDto, type LoanDto, LOANS_PER_RETURN_MAX, type ReturnResult } from '@open-boox/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AddressPicker, defaultAddressId } from '@/components/addresses/address-picker';
import { BookCover } from '@/components/books/book-cover';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api/client';
import { ApiError } from '@/lib/api/error';
import { messageFor } from '@/lib/errors/messages';
import { formatDate } from '@/lib/format';
import { LOAN_STATUS_LABEL } from '@/lib/loans/labels';
import { toggleLoan } from '@/lib/loans/selection';
import { SHIPMENT_STATUS_LABEL } from '@/lib/shipments/labels';

const box = 'flex flex-col gap-[18px] rounded-[20px] border border-ink p-[24px]';

export function LoansView({ loans, addresses }: { loans: LoanDto[]; addresses: AddressDto[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [addressId, setAddressId] = useState<string | null>(() => defaultAddressId(addresses));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const returnable = loans.filter((loan) => loan.status === 'ACTIVE');
  // After a refresh some selected loans may no longer be returnable; ignore them.
  const chosen = selected.filter((id) => returnable.some((loan) => loan.id === id));

  async function returnBooks() {
    if (!addressId || chosen.length === 0) return;
    setPending(true);
    setError(null);
    try {
      await apiClient<ReturnResult>('/loans/return', { method: 'POST', body: { loanIds: chosen, addressId } });
      setSelected([]);
    } catch (e) {
      setError(messageFor(e instanceof ApiError ? e.code : 'INTERNAL_ERROR'));
    } finally {
      setPending(false);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-[31px]">
      <ul className="flex flex-col gap-[12px]">
        {loans.map((loan) => (
          <li
            key={loan.id}
            className="flex flex-wrap items-center gap-[18px] rounded-[20px] border border-ink p-[18px]"
          >
            {loan.status === 'ACTIVE' && (
              <input
                type="checkbox"
                aria-label={`Chọn trả ${loan.book.title}`}
                checked={chosen.includes(loan.id)}
                disabled={!chosen.includes(loan.id) && chosen.length >= LOANS_PER_RETURN_MAX}
                onChange={() => setSelected(toggleLoan(chosen, loan.id))}
              />
            )}
            <div className="w-[56px] shrink-0">
              <BookCover src={loan.book.coverUrl} title={loan.book.title} sizes="56px" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-[4px]">
              <Link href={`/books/${loan.book.slug}`} className="text-[16px] font-bold uppercase">
                {loan.book.title}
              </Link>
              <p className="text-[14px]">
                Yêu cầu {formatDate(loan.requestedAt)} · Giao hàng: {SHIPMENT_STATUS_LABEL[loan.shipmentStatus]}
              </p>
            </div>
            <span className={`text-[12px] font-bold uppercase tracking-[0.03em] ${loan.status === 'CANCELLED' ? 'text-ember' : ''}`}>
              {LOAN_STATUS_LABEL[loan.status]}
            </span>
          </li>
        ))}
      </ul>
      {returnable.length > 0 && (
        <section className={box}>
          <h2 className="text-[16px] font-bold uppercase tracking-[0.03em]">Trả sách</h2>
          <p className="text-[14px]">Chọn tối đa {LOANS_PER_RETURN_MAX} cuốn; một lần thu hồi cho tất cả, miễn phí.</p>
          <AddressPicker addresses={addresses} value={addressId} onChange={setAddressId} name="return-address" />
          {error && (
            <p role="alert" className="text-[14px] text-ember">
              {error}
            </p>
          )}
          <Button className="self-start" disabled={chosen.length === 0 || !addressId || pending} onClick={returnBooks}>
            Trả sách ({chosen.length})
          </Button>
        </section>
      )}
    </div>
  );
}
