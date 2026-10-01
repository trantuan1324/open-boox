import { PageTitle } from '@/components/ui/page-title';
import { safeNextPath } from '@/lib/auth/route-access';
import { LoginForm } from './login-form';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="sheet mx-auto flex w-full max-w-md flex-col gap-10 px-[20px] py-[48px] md:px-[32px] md:py-[72px]">
      <PageTitle>Đăng nhập</PageTitle>
      <LoginForm next={safeNextPath(next)} />
    </div>
  );
}
