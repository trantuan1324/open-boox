import type { OrderDetail } from '@open-boox/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AddressLines } from '@/components/addresses/address-lines';
import { DeliveryAttempts } from '@/components/shipments/delivery-attempts';
import { PageTitle } from '@/components/ui/page-title';
import { nullOn404 } from '@/lib/api/error';
import { apiServer } from '@/lib/api/server';
import { formatDateTime, formatVnd } from '@/lib/format';
import { ORDER_STATUS_LABEL } from '@/lib/orders/labels';
import { CancelOrderButton } from './cancel-order-button';

const box = 'flex flex-col gap-[18px] rounded-[20px] border border-ink p-[24px]';

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await apiServer<OrderDetail>(`/orders/${encodeURIComponent(id)}`).catch(nullOn404);
  if (!order) notFound();

  return (
    <div className="sheet mx-auto flex w-full max-w-3xl flex-col gap-[31px] px-[20px] py-[48px] md:px-[48px] md:py-[72px]">
      <div className="flex flex-col gap-[12px]">
        <Link href="/account/orders" className="self-start text-[12px] font-bold uppercase tracking-[0.03em] underline">
          Đơn hàng
        </Link>
        <PageTitle>Chi tiết đơn</PageTitle>
        <p className="text-[16px]">
          {formatDateTime(order.createdAt)} ·{' '}
          <span className={`font-bold uppercase ${order.status === 'CANCELLED' ? 'text-ember' : ''}`}>
            {ORDER_STATUS_LABEL[order.status]}
          </span>
        </p>
      </div>

      {order.status === 'PENDING_PAYMENT' && (
        <div className="flex flex-wrap items-start gap-[12px]">
          {order.pendingPaymentId && (
            <Link
              href={`/checkout/mock/${order.pendingPaymentId}`}
              className="rounded-full bg-ink px-6 py-3.5 text-[13px] font-bold uppercase tracking-[0.03em] leading-none text-paper"
            >
              Thanh toán
            </Link>
          )}
          <CancelOrderButton orderId={order.id} />
        </div>
      )}

      <section className={box}>
        <h2 className="text-[16px] font-bold uppercase tracking-[0.03em]">Sách</h2>
        <ul className="flex flex-col gap-[12px]">
          {order.items.map((item) => (
            <li key={item.bookId} className="flex flex-wrap justify-between gap-[12px] text-[16px]">
              <Link href={`/books/${item.slug}`} className="underline">
                {item.title}
              </Link>
              <span>
                {item.quantity} × {formatVnd(item.unitPrice)} = {formatVnd(item.lineTotal)}
              </span>
            </li>
          ))}
        </ul>
        <dl className="grid grid-cols-[1fr_max-content] gap-y-[8px] text-[16px]">
          <dt>Tạm tính</dt>
          <dd>{formatVnd(order.subtotal)}</dd>
          <dt>Phí giao hàng</dt>
          <dd>{formatVnd(order.shippingFee)}</dd>
          <dt className="font-bold uppercase">Tổng</dt>
          <dd className="font-medium">{formatVnd(order.total)}</dd>
        </dl>
      </section>

      {order.shipments.length > 0 && (
        <section className={box}>
          <h2 className="text-[16px] font-bold uppercase tracking-[0.03em]">Giao hàng</h2>
          <DeliveryAttempts shipments={order.shipments} />
        </section>
      )}

      <section className={box}>
        <h2 className="text-[16px] font-bold uppercase tracking-[0.03em]">Giao tới</h2>
        <AddressLines address={order.address} />
      </section>
    </div>
  );
}
