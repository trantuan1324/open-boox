import type { AddressDto } from '@open-boox/shared';
import { PageTitle } from '@/components/ui/page-title';
import { apiServer } from '@/lib/api/server';
import { BorrowConfirmView } from './borrow-confirm-view';

export default async function BorrowConfirmPage() {
  const addresses = await apiServer<AddressDto[]>('/addresses');
  return (
    <div className="sheet sheet-pad flex w-full flex-col gap-[31px]">
      <PageTitle>Xác nhận mượn</PageTitle>
      <BorrowConfirmView addresses={addresses} />
    </div>
  );
}
