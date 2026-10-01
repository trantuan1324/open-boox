import { adminLoanListQuerySchema, type AdminLoanRow, LOAN_STATUSES, type Paged, shortCode } from '@open-boox/shared';
import Link from 'next/link';
import { Chip } from '@/components/ui/chip';
import { PageTitle } from '@/components/ui/page-title';
import { adminHref, adminSearch } from '@/lib/admin/search';
import { apiServer } from '@/lib/api/server';
import { formatDateTime } from '@/lib/format';
import { LOAN_STATUS_LABEL } from '@/lib/loans/labels';

const TH = 'py-[10px] pr-[18px] text-left text-[12px] font-bold uppercase tracking-[0.03em]';
const TD = 'py-[10px] pr-[18px] text-[14px]';

export default async function AdminLoansPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { status, shipmentId, page } = adminLoanListQuerySchema.parse(await searchParams);
  const result = await apiServer<Paged<AdminLoanRow>>(`/admin/loans${adminSearch({ status, shipmentId, page })}`);
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const href = (change: { status?: string; page?: number }) => adminHref('/admin/loans', { status, shipmentId, page }, change);

  return (
    <div className="flex flex-col gap-[31px]">
      <PageTitle>Mượn sách</PageTitle>
      <nav aria-label="Lọc theo trạng thái" className="flex flex-wrap gap-[8px]">
        <Chip href={href({ status: undefined })} active={!status}>
          Mọi trạng thái
        </Chip>
        {LOAN_STATUSES.map((s) => (
          <Chip key={s} href={href({ status: s })} active={status === s}>
            {LOAN_STATUS_LABEL[s]}
          </Chip>
        ))}
      </nav>
      {result.items.length === 0 ? (
        <p className="rounded-[20px] border border-ink p-[24px] text-[16px]">Chưa có yêu cầu mượn nào.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="border-b border-ink">
              <tr>
                <th className={TH}>Mã</th>
                <th className={TH}>Ngày yêu cầu</th>
                <th className={TH}>Khách</th>
                <th className={TH}>Sách</th>
                <th className={TH}>Barcode</th>
                <th className={TH}>Trạng thái</th>
                <th className={TH}>Giao</th>
                <th className={TH}>Thu hồi</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((loan) => (
                <tr key={loan.id} className="border-b border-ink">
                  <td className={TD}>{shortCode(loan.id)}</td>
                  <td className={TD}>{formatDateTime(loan.requestedAt)}</td>
                  <td className={TD}>{loan.customerEmail}</td>
                  <td className={TD}>{loan.bookTitle}</td>
                  <td className={TD}>{loan.barcode}</td>
                  <td className={`${TD} ${loan.status === 'CANCELLED' ? 'text-ember' : ''}`}>
                    {LOAN_STATUS_LABEL[loan.status]}
                  </td>
                  <td className={TD}>
                    <Link href={`/admin/shipments/${loan.deliveryShipmentId}`} className="underline">
                      {shortCode(loan.deliveryShipmentId)}
                    </Link>
                  </td>
                  <td className={TD}>
                    {loan.returnShipmentId ? (
                      <Link href={`/admin/shipments/${loan.returnShipmentId}`} className="underline">
                        {shortCode(loan.returnShipmentId)}
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
