import { PageTitle } from '@/components/ui/page-title';
import { safeNextPath } from '@/lib/auth/route-access';
import { RegisterForm } from './register-form';

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="sheet mx-auto flex w-full max-w-md flex-col gap-10 px-[20px] py-[48px] md:px-[32px] md:py-[72px]">
      <PageTitle>Đăng ký</PageTitle>
      <RegisterForm next={safeNextPath(next)} />
    </div>
  );
}
