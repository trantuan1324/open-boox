import { type AddressDto, type CurrentSubscription, type LoanDto, loanListQuerySchema, type Paged } from '@open-boox/shared';
import Link from 'next/link';
import { PageTitle } from '@/components/ui/page-title';
import { apiServer } from '@/lib/api/server';
import { needsReturnReminder } from '@/lib/loans/selection';
import { LoansView } from './loans-view';

export default async function LoansPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { page } = loanListQuerySchema.parse(await searchParams);
  const [loans, { subscription }, addresses] = await Promise.all([
    apiServer<Paged<LoanDto>>(`/loans?page=${page}`),
    apiServer<CurrentSubscription>('/subscriptions/current'),
    apiServer<AddressDto[]>('/addresses'),
  ]);
  const totalPages = Math.max(1, Math.ceil(loans.total / loans.pageSize));

  return (
    <div className="sheet mx-auto flex w-full max-w-3xl flex-col gap-[31px] px-[20px] py-[48px] md:px-[48px] md:py-[72px]">
      <PageTitle>Sách đang mượn</PageTitle>
      {needsReturnReminder(subscription, loans.items) && (
        <p role="status" className="rounded-[20px] border border-ink p-[18px] text-[16px] text-ember">
          Gói đã hết hạn — hãy trả sách.{' '}
          <Link href="/plans" className="font-bold uppercase tracking-[0.03em] underline">
            Xem các gói
          </Link>
        </p>
      )}
      {loans.items.length === 0 ? (
        <div className="flex flex-col gap-[12px] rounded-[20px] border border-ink p-[24px]">
          <p className="text-[16px]">Bạn chưa mượn sách nào.</p>
          <Link href="/books?availability=loan" className="self-start text-[12px] font-bold uppercase tracking-[0.03em] underline">
            Xem sách cho mượn
          </Link>
        </div>
      ) : (
        <LoansView loans={loans.items} addresses={addresses} />
      )}
      {totalPages > 1 && (
        <nav aria-label="Phân trang" className="flex items-center gap-[18px] text-[12px] font-bold uppercase tracking-[0.03em]">
          {page > 1 && <Link href={`/account/loans?page=${page - 1}`}>Trang trước</Link>}
          <span>
            Trang {page}/{totalPages}
          </span>
          {page < totalPages && <Link href={`/account/loans?page=${page + 1}`}>Trang sau</Link>}
        </nav>
      )}
    </div>
  );
}
