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

const box = 'flex flex-col gap-[18px] rounded-[12px] border border-dashed border-cork-border p-[24px]';

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await apiServer<OrderDetail>(`/orders/${encodeURIComponent(id)}`).catch(nullOn404);
  if (!order) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-[31px] px-[24px] py-[41px]">
      <div className="flex flex-col gap-[12px]">
        <Link href="/account/orders" className="self-start text-[12px] font-medium uppercase underline">
          Đơn hàng
        </Link>
        <PageTitle>Chi tiết đơn</PageTitle>
        <p className="text-[16px]">
          {formatDateTime(order.createdAt)} ·{' '}
          <span className={`font-medium uppercase ${order.status === 'CANCELLED' ? 'text-ember-accent' : ''}`}>
            {ORDER_STATUS_LABEL[order.status]}
          </span>
        </p>
      </div>

      {order.status === 'PENDING_PAYMENT' && (
        <div className="flex flex-wrap items-start gap-[12px]">
          {order.pendingPaymentId && (
            <Link
              href={`/checkout/mock/${order.pendingPaymentId}`}
              className="rounded-[36px] bg-bark-brown px-6 py-3.5 text-[14px] font-medium uppercase leading-none"
            >
              Thanh toán
            </Link>
          )}
          <CancelOrderButton orderId={order.id} />
        </div>
      )}

      <section className={box}>
        <h2 className="text-[18px] font-medium uppercase">Sách</h2>
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
          <dt className="font-medium uppercase">Tổng</dt>
          <dd className="font-medium">{formatVnd(order.total)}</dd>
        </dl>
      </section>

      {order.shipments.length > 0 && (
        <section className={box}>
          <h2 className="text-[18px] font-medium uppercase">Giao hàng</h2>
          <DeliveryAttempts shipments={order.shipments} />
        </section>
      )}

      <section className={box}>
        <h2 className="text-[18px] font-medium uppercase">Giao tới</h2>
        <AddressLines address={order.address} />
      </section>
    </div>
  );
}
