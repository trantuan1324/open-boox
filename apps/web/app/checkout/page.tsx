import type { AddressDto } from '@open-boox/shared';
import { PageTitle } from '@/components/ui/page-title';
import { apiServer } from '@/lib/api/server';
import { CheckoutView } from './checkout-view';

export default async function CheckoutPage() {
  const addresses = await apiServer<AddressDto[]>('/addresses');
  return (
    <div className="sheet sheet-pad flex w-full flex-col gap-[31px]">
      <PageTitle>Đặt hàng</PageTitle>
      <CheckoutView addresses={addresses} />
    </div>
  );
}
