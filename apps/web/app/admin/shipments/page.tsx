import {
  adminShipmentListQuerySchema,
  type AdminShipmentRow,
  type Paged,
  SHIPMENT_STATUSES,
  SHIPMENT_TYPES,
  shortCode,
} from '@open-boox/shared';
import Link from 'next/link';
import { Chip } from '@/components/ui/chip';
import { PageTitle } from '@/components/ui/page-title';
import { adminHref, adminSearch } from '@/lib/admin/search';
import { apiServer } from '@/lib/api/server';
import { formatDateTime } from '@/lib/format';
import { SHIPMENT_STATUS_LABEL, SHIPMENT_TYPE_LABEL } from '@/lib/shipments/labels';

const TH = 'py-[10px] pr-[18px] text-left text-[12px] font-bold uppercase tracking-[0.03em]';
const TD = 'py-[10px] pr-[18px] text-[14px]';

export default async function AdminShipmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { status, type, page } = adminShipmentListQuerySchema.parse(await searchParams);
  const result = await apiServer<Paged<AdminShipmentRow>>(`/admin/shipments${adminSearch({ status, type, page })}`);
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const href = (change: { status?: string; type?: string; page?: number }) =>
    adminHref('/admin/shipments', { status, type, page }, change);

  return (
    <div className="flex flex-col gap-[31px]">
      <PageTitle>Giao hàng</PageTitle>
      <div className="flex flex-col gap-[12px]">
        <nav aria-label="Lọc theo trạng thái" className="flex flex-wrap gap-[8px]">
          <Chip href={href({ status: undefined })} active={!status}>
            Mọi trạng thái
          </Chip>
          {SHIPMENT_STATUSES.map((s) => (
            <Chip key={s} href={href({ status: s })} active={status === s}>
              {SHIPMENT_STATUS_LABEL[s]}
            </Chip>
          ))}
        </nav>
        <nav aria-label="Lọc theo loại" className="flex flex-wrap gap-[8px]">
          <Chip href={href({ type: undefined })} active={!type}>
            Mọi loại
          </Chip>
          {SHIPMENT_TYPES.map((t) => (
            <Chip key={t} href={href({ type: t })} active={type === t}>
              {SHIPMENT_TYPE_LABEL[t]}
            </Chip>
          ))}
        </nav>
      </div>
      {result.items.length === 0 ? (
        <p className="rounded-[20px] border border-ink p-[24px] text-[16px]">Chưa có lần giao nào.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="border-b border-ink">
              <tr>
                <th className={TH}>Mã</th>
                <th className={TH}>Ngày tạo</th>
                <th className={TH}>Loại</th>
                <th className={TH}>Đơn</th>
                <th className={TH}>Trạng thái</th>
                <th className={TH}>Tạo lại</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((s) => (
                <tr key={s.id} className="border-b border-ink">
                  <td className={TD}>{shortCode(s.id)}</td>
                  <td className={TD}>
                    <Link href={`/admin/shipments/${s.id}`} className="underline">
                      {formatDateTime(s.createdAt)}
                    </Link>
                  </td>
                  <td className={TD}>{SHIPMENT_TYPE_LABEL[s.type]}</td>
                  <td className={TD}>
                    {s.orderId ? (
                      <Link href={`/admin/orders/${s.orderId}`} className="underline">
                        Xem đơn
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={`${TD} ${s.status === 'FAILED' ? 'text-ember' : ''}`}>
                    {SHIPMENT_STATUS_LABEL[s.status]}
                  </td>
                  <td className={TD}>
                    {s.retriedById ? (
                      <Link href={`/admin/shipments/${s.retriedById}`} className="underline">
                        Đã tạo lại →
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {totalPages > 1 && (
        <nav aria-label="Phân trang" className="flex items-center gap-[18px] text-[12px] font-bold uppercase tracking-[0.03em]">
          {page > 1 && <Link href={href({ page: page - 1 })}>Trước</Link>}
          <span>
            Trang {page}/{totalPages}
          </span>
          {page < totalPages && <Link href={href({ page: page + 1 })}>Sau</Link>}
        </nav>
      )}
    </div>
  );
}
