import type { AddressDto } from '@open-boox/shared';
import { PageTitle } from '@/components/ui/page-title';
import { apiServer } from '@/lib/api/server';
import { AddressManager } from './address-manager';

export default async function AddressesPage() {
  const addresses = await apiServer<AddressDto[]>('/addresses');
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-[31px] px-[24px] py-[41px]">
      <PageTitle>Địa chỉ</PageTitle>
      <AddressManager addresses={addresses} />
    </div>
  );
}
