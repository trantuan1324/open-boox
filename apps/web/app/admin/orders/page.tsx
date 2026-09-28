import { type AdminOrderRow, adminOrderListQuerySchema, ORDER_STATUSES, type Paged, shortCode } from '@open-boox/shared';
import Link from 'next/link';
import { Chip } from '@/components/ui/chip';
import { PageTitle } from '@/components/ui/page-title';
import { adminHref, adminSearch } from '@/lib/admin/search';
import { apiServer } from '@/lib/api/server';
import { formatDateTime, formatVnd } from '@/lib/format';
import { ORDER_STATUS_LABEL } from '@/lib/orders/labels';
import { SHIPMENT_STATUS_LABEL } from '@/lib/shipments/labels';

const TH = 'py-[10px] pr-[18px] text-left text-[12px] font-medium uppercase';
const TD = 'py-[10px] pr-[18px] text-[14px]';

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { status, page } = adminOrderListQuerySchema.parse(await searchParams);
  const result = await apiServer<Paged<AdminOrderRow>>(`/admin/orders${adminSearch({ status, page })}`);
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const href = (change: { status?: string; page?: number }) => adminHref('/admin/orders', { status, page }, change);

  return (
    <div className="flex flex-col gap-[31px]">
      <PageTitle>Đơn hàng</PageTitle>
      <nav aria-label="Lọc theo trạng thái" className="flex flex-wrap gap-[8px]">
        <Chip href={href({ status: undefined })} active={!status}>
          Tất cả
        </Chip>
        {ORDER_STATUSES.map((s) => (
          <Chip key={s} href={href({ status: s })} active={status === s}>
            {ORDER_STATUS_LABEL[s]}
          </Chip>
        ))}
      </nav>
      {result.items.length === 0 ? (
        <p className="rounded-[12px] border border-dashed border-cork-border p-[24px] text-[16px]">Chưa có đơn hàng nào.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="border-b border-dashed border-cork-border">
              <tr>
                <th className={TH}>Mã</th>
                <th className={TH}>Ngày đặt</th>
                <th className={TH}>Khách</th>
                <th className={TH}>Trạng thái</th>
                <th className={TH}>Giao hàng</th>
                <th className={TH}>Số cuốn</th>
                <th className={TH}>Tổng</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((order) => (
                <tr key={order.id} className="border-b border-dashed border-cork-border">
                  <td className={TD}>{shortCode(order.id)}</td>
                  <td className={TD}>
                    <Link href={`/admin/orders/${order.id}`} className="underline">
                      {formatDateTime(order.createdAt)}
                    </Link>
                  </td>
                  <td className={TD}>{order.customerEmail}</td>
                  <td className={`${TD} ${order.status === 'CANCELLED' ? 'text-ember-accent' : ''}`}>
                    {ORDER_STATUS_LABEL[order.status]}
                  </td>
                  <td className={`${TD} ${order.latestShipmentStatus === 'FAILED' ? 'text-ember-accent' : ''}`}>
                    {order.latestShipmentStatus ? SHIPMENT_STATUS_LABEL[order.latestShipmentStatus] : '—'}
                  </td>
                  <td className={TD}>{order.itemCount}</td>
                  <td className={TD}>{formatVnd(order.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {totalPages > 1 && (
        <nav aria-label="Phân trang" className="flex items-center gap-[18px] text-[12px] font-medium uppercase">
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
