import type { PublicUser } from '@open-boox/shared';
import Link from 'next/link';
import { PageTitle } from '@/components/ui/page-title';
import { apiServer } from '@/lib/api/server';
import { LogoutButton } from './logout-button';

export default async function AccountPage() {
  const user = await apiServer<PublicUser>('/auth/me');
  return (
    <div className="sheet mx-auto flex w-full max-w-3xl flex-col gap-10 px-[20px] py-[48px] md:px-[48px] md:py-[72px]">
      <PageTitle>Tài khoản</PageTitle>
      <nav aria-label="Tài khoản" className="flex gap-[18px] text-[12px] font-bold uppercase tracking-[0.03em]">
        <Link href="/account/orders" className="underline">
          Đơn hàng
        </Link>
        <Link href="/account/loans" className="underline">
          Sách mượn
        </Link>
        <Link href="/account/addresses" className="underline">
          Địa chỉ
        </Link>
        <Link href="/account/subscription" className="underline">
          Gói đăng ký
        </Link>
      </nav>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-8 gap-y-4 rounded-[20px] border border-ink p-6 text-[16px]">
        <dt className="text-[12px] font-bold uppercase tracking-[0.03em]">Họ tên</dt>
        <dd>{user.fullName}</dd>
        <dt className="text-[12px] font-bold uppercase tracking-[0.03em]">Email</dt>
        <dd>{user.email}</dd>
        <dt className="text-[12px] font-bold uppercase tracking-[0.03em]">Điện thoại</dt>
        <dd>{user.phone}</dd>
      </dl>
      <LogoutButton />
    </div>
  );
}
