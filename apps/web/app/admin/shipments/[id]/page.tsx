import type { AdminShipmentDetail } from '@open-boox/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AddressLines } from '@/components/addresses/address-lines';
import { ShipmentEvents } from '@/components/shipments/shipment-events';
import { PageTitle } from '@/components/ui/page-title';
import { nullOn404 } from '@/lib/api/error';
import { apiServer } from '@/lib/api/server';
import { formatDateTime, formatVnd } from '@/lib/format';
import { SHIPMENT_STATUS_LABEL, SHIPMENT_TYPE_LABEL } from '@/lib/shipments/labels';
import { ShipmentActions } from './shipment-actions';

const box = 'flex flex-col gap-[18px] rounded-[12px] border border-dashed border-cork-border p-[24px]';

export default async function AdminShipmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const shipment = await apiServer<AdminShipmentDetail>(`/admin/shipments/${encodeURIComponent(id)}`).catch(nullOn404);
  if (!shipment) notFound();

  return (
    <div className="flex flex-col gap-[31px]">
      <div className="flex flex-col gap-[12px]">
        <Link href="/admin/shipments" className="self-start text-[12px] font-medium uppercase underline">
          Giao hàng
        </Link>
        <PageTitle>{SHIPMENT_TYPE_LABEL[shipment.type]}</PageTitle>
        <p className="text-[16px]">
          {formatDateTime(shipment.createdAt)} ·{' '}
          <span className={`font-medium uppercase ${shipment.status === 'FAILED' ? 'text-ember-accent' : ''}`}>
            {SHIPMENT_STATUS_LABEL[shipment.status]}
          </span>{' '}
          · Phí {formatVnd(shipment.fee)}
        </p>
        <div className="flex flex-wrap gap-[18px] text-[12px] font-medium uppercase">
          {shipment.orderId && (
            <Link href={`/admin/orders/${shipment.orderId}`} className="underline">
              Xem đơn
            </Link>
          )}
          {shipment.retryOfId && (
            <Link href={`/admin/shipments/${shipment.retryOfId}`} className="underline">
              ← Lần giao trước
            </Link>
          )}
          {shipment.retriedById && (
            <Link href={`/admin/shipments/${shipment.retriedById}`} className="underline">
              Lần giao mới →
            </Link>
          )}
        </div>
      </div>

      <section className={box}>
        <h2 className="text-[18px] font-medium uppercase">Cập nhật</h2>
        {shipment.status === 'DELIVERED' || (shipment.status === 'FAILED' && shipment.retriedById) ? (
          <p className="text-[16px]">Lần giao này đã kết thúc.</p>
        ) : (
          <ShipmentActions shipment={shipment} />
        )}
      </section>

      <section className={box}>
        <h2 className="text-[18px] font-medium uppercase">Lịch sử</h2>
        <ShipmentEvents events={shipment.events} />
      </section>

      <section className={box}>
        <h2 className="text-[18px] font-medium uppercase">Giao tới</h2>
        <AddressLines address={shipment.address} />
      </section>
    </div>
  );
}
