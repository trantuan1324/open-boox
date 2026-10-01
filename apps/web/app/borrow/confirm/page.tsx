import type { AddressDto } from '@open-boox/shared';
import { PageTitle } from '@/components/ui/page-title';
import { apiServer } from '@/lib/api/server';
import { BorrowConfirmView } from './borrow-confirm-view';

export default async function BorrowConfirmPage() {
  const addresses = await apiServer<AddressDto[]>('/addresses');
  return (
    <div className="sheet mx-auto flex w-full max-w-3xl flex-col gap-[31px] px-[20px] py-[48px] md:px-[48px] md:py-[72px]">
      <PageTitle>Xác nhận mượn</PageTitle>
      <BorrowConfirmView addresses={addresses} />
    </div>
  );
}
