import type { AdminOrderDetail } from '@open-boox/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AddressLines } from '@/components/addresses/address-lines';
import { DeliveryAttempts } from '@/components/shipments/delivery-attempts';
import { PageTitle } from '@/components/ui/page-title';
import { nullOn404 } from '@/lib/api/error';
import { apiServer } from '@/lib/api/server';
import { formatDateTime, formatVnd } from '@/lib/format';
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from '@/lib/orders/labels';

const box = 'flex flex-col gap-[18px] rounded-[20px] border border-ink p-[24px]';

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await apiServer<AdminOrderDetail>(`/admin/orders/${encodeURIComponent(id)}`).catch(nullOn404);
  if (!order) notFound();

  return (
    <div className="flex flex-col gap-[31px]">
      <div className="flex flex-col gap-[12px]">
        <Link href="/admin/orders" className="self-start text-[12px] font-bold uppercase tracking-[0.03em] underline">
          Đơn hàng
        </Link>
        <PageTitle>Chi tiết đơn</PageTitle>
        <p className="text-[16px]">
          {formatDateTime(order.createdAt)} ·{' '}
          <span className={`font-bold uppercase ${order.status === 'CANCELLED' ? 'text-ember' : ''}`}>
            {ORDER_STATUS_LABEL[order.status]}
          </span>{' '}
          · Thanh toán: {order.paymentStatus ? PAYMENT_STATUS_LABEL[order.paymentStatus] : '—'}
        </p>
        <p className="text-[16px]">
          {order.customer.fullName} · {order.customer.email}
        </p>
      </div>

      <section className={box}>
        <h2 className="text-[16px] font-bold uppercase tracking-[0.03em]">Sách</h2>
        <ul className="flex flex-col gap-[12px]">
          {order.items.map((item) => (
            <li key={item.bookId} className="flex flex-wrap justify-between gap-[12px] text-[16px]">
              <span>{item.title}</span>
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

      <section className={box}>
        <h2 className="text-[16px] font-bold uppercase tracking-[0.03em]">Giao hàng</h2>
        {order.shipments.length === 0 ? (
          <p className="text-[16px]">Chưa có lần giao nào.</p>
        ) : (
          <DeliveryAttempts shipments={order.shipments} linkToAdmin />
        )}
      </section>

      <section className={box}>
        <h2 className="text-[16px] font-bold uppercase tracking-[0.03em]">Giao tới</h2>
        <AddressLines address={order.address} />
      </section>
    </div>
  );
}
