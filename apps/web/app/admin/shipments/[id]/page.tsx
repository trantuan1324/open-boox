import { type AdminLoanRow, type AdminShipmentDetail, type Paged, shortCode } from '@open-boox/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AddressLines } from '@/components/addresses/address-lines';
import { ShipmentEvents } from '@/components/shipments/shipment-events';
import { PageTitle } from '@/components/ui/page-title';
import { errorFromParam } from '@/lib/admin/error-param';
import { nullOn404 } from '@/lib/api/error';
import { apiServer } from '@/lib/api/server';
import { messageFor } from '@/lib/errors/messages';
import { formatDateTime, formatVnd } from '@/lib/format';
import { LOAN_STATUS_LABEL } from '@/lib/loans/labels';
import { SHIPMENT_STATUS_LABEL, SHIPMENT_TYPE_LABEL } from '@/lib/shipments/labels';
import { CancelLoansButton } from './cancel-loans-button';
import { ShipmentActions } from './shipment-actions';

const box = 'flex flex-col gap-[18px] rounded-[20px] border border-ink p-[24px]';

export default async function AdminShipmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const error = errorFromParam((await searchParams).error);
  const shipment = await apiServer<AdminShipmentDetail>(`/admin/shipments/${encodeURIComponent(id)}`).catch(nullOn404);
  if (!shipment) notFound();
  const loans =
    shipment.type === 'ORDER_DELIVERY'
      ? null
      : await apiServer<Paged<AdminLoanRow>>(`/admin/loans?shipmentId=${encodeURIComponent(shipment.id)}`);
  const loansCancelled = loans !== null && loans.items.length > 0 && loans.items.every((l) => l.status === 'CANCELLED');
  const finished =
    shipment.status === 'DELIVERED' || (shipment.status === 'FAILED' && (shipment.retriedById !== null || loansCancelled));
  const canCancelLoans =
    shipment.type === 'LOAN_DELIVERY' &&
    shipment.status === 'FAILED' &&
    !shipment.retriedById &&
    loans !== null &&
    loans.items.some((l) => l.status === 'REQUESTED');

  return (
    <div className="flex flex-col gap-[31px]">
      <div className="flex flex-col gap-[12px]">
        <Link href="/admin/shipments" className="self-start text-[12px] font-bold uppercase tracking-[0.03em] underline">
          Giao hàng
        </Link>
        <PageTitle>
          {SHIPMENT_TYPE_LABEL[shipment.type]} · {shortCode(shipment.id)}
        </PageTitle>
        <p className="text-[16px]">
          {formatDateTime(shipment.createdAt)} ·{' '}
          <span className={`font-bold uppercase ${shipment.status === 'FAILED' ? 'text-ember' : ''}`}>
            {SHIPMENT_STATUS_LABEL[shipment.status]}
          </span>{' '}
          · Phí {formatVnd(shipment.fee)}
        </p>
        <div className="flex flex-wrap gap-[18px] text-[12px] font-bold uppercase tracking-[0.03em]">
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

      {error && (
        <p role="alert" className="rounded-[20px] border border-ink p-[18px] text-[16px] text-ember">
          {messageFor(error)}
        </p>
      )}

      <section className={box}>
        <h2 className="text-[16px] font-bold uppercase tracking-[0.03em]">Cập nhật</h2>
        {finished ? <p className="text-[16px]">Lần giao này đã kết thúc.</p> : <ShipmentActions shipment={shipment} />}
        {canCancelLoans && <CancelLoansButton shipmentId={shipment.id} />}
      </section>

      {loans && (
        <section className={box}>
          <h2 className="text-[16px] font-bold uppercase tracking-[0.03em]">Sách mượn</h2>
          {loans.items.length === 0 ? (
            <p className="text-[16px]">
              {shipment.retriedById ? 'Các yêu cầu mượn đã chuyển sang lần giao mới.' : 'Không có yêu cầu mượn nào.'}
            </p>
          ) : (
            <ul className="flex flex-col gap-[8px] text-[14px]">
              {loans.items.map((loan) => (
                <li key={loan.id} className="flex flex-wrap justify-between gap-[12px]">
                  <span>
                    {shortCode(loan.id)} · {loan.bookTitle} · {loan.barcode} · {loan.customerEmail}
                  </span>
                  <span className={`font-bold uppercase ${loan.status === 'CANCELLED' ? 'text-ember' : ''}`}>
                    {LOAN_STATUS_LABEL[loan.status]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className={box}>
        <h2 className="text-[16px] font-bold uppercase tracking-[0.03em]">Lịch sử</h2>
        <ShipmentEvents events={shipment.events} />
      </section>

      <section className={box}>
        <h2 className="text-[16px] font-bold uppercase tracking-[0.03em]">Giao tới</h2>
        <AddressLines address={shipment.address} />
      </section>
    </div>
  );
}
