import type { PublicUser } from '@open-boox/shared';
import { Chip } from '@/components/ui/chip';
import { PageTitle } from '@/components/ui/page-title';
import { apiServer } from '@/lib/api/server';
import { LogoutButton } from './logout-button';

export default async function AccountPage() {
  const user = await apiServer<PublicUser>('/auth/me');
  return (
    <div className="sheet sheet-pad flex w-full flex-col gap-10">
      <PageTitle>Tài khoản</PageTitle>
      <div className="flex max-w-[640px] flex-col gap-10">
        <nav aria-label="Tài khoản" className="flex flex-wrap gap-[8px]">
          <Chip href="/account/orders" active={false}>
            Đơn hàng
          </Chip>
          <Chip href="/account/loans" active={false}>
            Sách mượn
          </Chip>
          <Chip href="/account/addresses" active={false}>
            Địa chỉ
          </Chip>
          <Chip href="/account/subscription" active={false}>
            Gói đăng ký
          </Chip>
        </nav>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-8 gap-y-4 rounded-[20px] border border-ink bg-sky p-6 text-[16px]">
          <dt className="text-[12px] font-bold uppercase tracking-[0.03em]">Họ tên</dt>
          <dd>{user.fullName}</dd>
          <dt className="text-[12px] font-bold uppercase tracking-[0.03em]">Email</dt>
          <dd>{user.email}</dd>
          <dt className="text-[12px] font-bold uppercase tracking-[0.03em]">Điện thoại</dt>
          <dd>{user.phone}</dd>
        </dl>
        <LogoutButton />
      </div>
    </div>
  );
}
