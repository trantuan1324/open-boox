import type { AddressDto } from '@open-boox/shared';
import { PageTitle } from '@/components/ui/page-title';
import { apiServer } from '@/lib/api/server';
import { AddressManager } from './address-manager';

export default async function AddressesPage() {
  const addresses = await apiServer<AddressDto[]>('/addresses');
  return (
    <div className="sheet mx-auto flex w-full max-w-3xl flex-col gap-[31px] px-[20px] py-[48px] md:px-[48px] md:py-[72px]">
      <PageTitle>Địa chỉ</PageTitle>
      <AddressManager addresses={addresses} />
    </div>
  );
}
