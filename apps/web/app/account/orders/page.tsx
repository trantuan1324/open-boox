import { type OrderSummary, orderListQuerySchema, type Paged } from '@open-boox/shared';
import Link from 'next/link';
import { PageTitle } from '@/components/ui/page-title';
import { apiServer } from '@/lib/api/server';
import { formatDateTime, formatVnd } from '@/lib/format';
import { ORDER_STATUS_LABEL } from '@/lib/orders/labels';

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { page } = orderListQuerySchema.parse(await searchParams);
  const result = await apiServer<Paged<OrderSummary>>(`/orders?page=${page}`);
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-[31px] px-[24px] py-[41px]">
      <PageTitle>Đơn hàng</PageTitle>
      {result.items.length === 0 ? (
        <div className="flex flex-col gap-[12px] rounded-[12px] border border-dashed border-cork-border p-[24px]">
          <p className="text-[16px]">Bạn chưa có đơn hàng nào.</p>
          <Link href="/books" className="self-start text-[12px] font-medium uppercase underline">
            Xem sách
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-[12px]">
          {result.items.map((order) => (
            <li key={order.id}>
              <Link
                href={`/account/orders/${order.id}`}
                className="flex flex-wrap items-center justify-between gap-[12px] rounded-[12px] border border-dashed border-cork-border p-[18px] text-[16px]"
              >
                <span>
                  {formatDateTime(order.createdAt)} · {order.itemCount} cuốn
                </span>
                <span>{formatVnd(order.total)}</span>
                <span
                  className={`text-[12px] font-medium uppercase ${order.status === 'CANCELLED' ? 'text-ember-accent' : ''}`}
                >
                  {ORDER_STATUS_LABEL[order.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {totalPages > 1 && (
        <nav aria-label="Phân trang" className="flex items-center gap-[18px] text-[12px] font-medium uppercase">
          {page > 1 && <Link href={`/account/orders?page=${page - 1}`}>Trang trước</Link>}
          <span>
            Trang {page}/{totalPages}
          </span>
          {page < totalPages && <Link href={`/account/orders?page=${page + 1}`}>Trang sau</Link>}
        </nav>
      )}
    </div>
  );
}
