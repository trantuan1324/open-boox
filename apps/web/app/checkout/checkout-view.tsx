'use client';

import type { AddressDto, OrderQuote, PlaceOrderResult } from '@open-boox/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AddressForm } from '@/components/addresses/address-form';
import { AddressLines } from '@/components/addresses/address-lines';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api/client';
import { useCart } from '@/lib/cart/use-cart';
import { formatVnd } from '@/lib/format';
import { describeQuoteError, type QuoteProblem } from '@/lib/orders/quote-errors';
import { quoteMatches } from '@/lib/orders/quote-match';

const box = 'flex flex-col gap-[18px] rounded-[12px] border border-dashed border-cork-border p-[24px]';

export function CheckoutView({ addresses }: { addresses: AddressDto[] }) {
  const router = useRouter();
  const { lines, ready, clear } = useCart();
  const [addressId, setAddressId] = useState<string | null>(
    () => (addresses.find((a) => a.isDefault) ?? addresses[0])?.id ?? null,
  );
  const [addingAddress, setAddingAddress] = useState(addresses.length === 0);
  const [fetchedQuote, setQuote] = useState<OrderQuote | null>(null);
  const [problem, setProblem] = useState<QuoteProblem | null>(null);
  const [placing, setPlacing] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const items = useMemo(() => lines.map(({ bookId, quantity }) => ({ bookId, quantity })), [lines]);
  const quote = fetchedQuote && quoteMatches(fetchedQuote, items) ? fetchedQuote : null;

  useEffect(() => {
    setQuote(null);
    setProblem(null);
    if (!addressId || items.length === 0) return;
    let cancelled = false;
    apiClient<OrderQuote>('/orders/quote', { method: 'POST', body: { items, addressId } })
      .then((result) => !cancelled && setQuote(result))
      .catch((error: unknown) => !cancelled && setProblem(describeQuoteError(error)));
    return () => {
      cancelled = true;
    };
  }, [addressId, items]);

  async function placeOrder() {
    if (!addressId) return;
    setPlacing(true);
    setProblem(null);
    try {
      const result = await apiClient<PlaceOrderResult>('/orders', { method: 'POST', body: { items, addressId } });
      setRedirecting(true);
      clear();
      router.push(result.redirectUrl);
    } catch (error) {
      setProblem(describeQuoteError(error));
      setPlacing(false);
    }
  }

  if (!ready) return null;
  if (redirecting) return <p className="text-[16px]">Đang chuyển tới trang thanh toán…</p>;
  if (lines.length === 0) {
    return (
      <div className={box}>
        <p className="text-[16px]">Giỏ hàng đang trống.</p>
        <Link href="/books" className="self-start text-[12px] font-medium uppercase underline">
          Xem sách
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[31px]">
      <section className={box}>
        <h2 className="text-[18px] font-medium uppercase">Giao tới</h2>
        {addresses.length > 0 && (
          <fieldset className="flex flex-col gap-[12px]">
            <legend className="sr-only">Chọn địa chỉ</legend>
            {addresses.map((address) => (
              <label key={address.id} className="flex items-start gap-[12px]">
                <input
                  type="radio"
                  name="address"
                  className="mt-[6px]"
                  checked={address.id === addressId}
                  onChange={() => setAddressId(address.id)}
                />
                <AddressLines address={address} />
              </label>
            ))}
          </fieldset>
        )}
        {addingAddress ? (
          <AddressForm
            onSaved={(saved) => {
              setAddressId(saved.id);
              setAddingAddress(false);
              router.refresh();
            }}
            onCancel={addresses.length > 0 ? () => setAddingAddress(false) : undefined}
          />
        ) : (
          <Button variant="ghost" className="self-start" onClick={() => setAddingAddress(true)}>
            Thêm địa chỉ khác
          </Button>
        )}
      </section>

      <section className={box}>
        <h2 className="text-[18px] font-medium uppercase">Sách</h2>
        <ul className="flex flex-col gap-[12px]">
          {lines.map((line, i) => (
            <li key={line.bookId} className="flex flex-col gap-[4px]">
              <div className="flex flex-wrap justify-between gap-[12px] text-[16px]">
                <span>
                  {line.title} × {line.quantity}
                </span>
                {quote && <span>{formatVnd(quote.items[i]!.lineTotal)}</span>}
              </div>
              {problem?.lines[i] && <p className="text-[14px] text-ember-accent">{problem.lines[i]}</p>}
            </li>
          ))}
        </ul>
        <Link href="/cart" className="self-start text-[12px] font-medium uppercase underline">
          Sửa giỏ hàng
        </Link>
      </section>

      <section className={box}>
        {quote ? (
          <dl className="grid grid-cols-[1fr_max-content] gap-y-[8px] text-[16px]">
            <dt>Tạm tính</dt>
            <dd>{formatVnd(quote.subtotal)}</dd>
            <dt>Phí giao hàng</dt>
            <dd>{formatVnd(quote.shippingFee)}</dd>
            <dt className="font-medium uppercase">Tổng</dt>
            <dd className="font-medium">{formatVnd(quote.total)}</dd>
          </dl>
        ) : (
          !problem && <p className="text-[16px]">{addressId ? 'Đang tính tiền…' : 'Chọn hoặc thêm địa chỉ giao hàng.'}</p>
        )}
        {problem && (
          <p role="alert" className="text-[14px] text-ember-accent">
            {problem.message}
          </p>
        )}
        <Button className="self-start" disabled={!quote || placing} onClick={placeOrder}>
          Đặt hàng
        </Button>
      </section>
    </div>
  );
}
