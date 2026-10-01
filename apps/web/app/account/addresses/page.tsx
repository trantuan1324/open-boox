import type { AddressDto } from '@open-boox/shared';
import { PageTitle } from '@/components/ui/page-title';
import { apiServer } from '@/lib/api/server';
import { AddressManager } from './address-manager';

export default async function AddressesPage() {
  const addresses = await apiServer<AddressDto[]>('/addresses');
  return (
    <div className="sheet sheet-pad flex w-full flex-col gap-[31px]">
      <PageTitle>Địa chỉ</PageTitle>
      <div className="max-w-[820px]">
        <AddressManager addresses={addresses} />
      </div>
    </div>
  );
}
