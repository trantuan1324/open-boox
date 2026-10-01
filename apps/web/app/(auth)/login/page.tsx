import { PageTitle } from '@/components/ui/page-title';
import { safeNextPath } from '@/lib/auth/route-access';
import { LoginForm } from './login-form';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="sheet sheet-pad flex w-full flex-col gap-10">
      <PageTitle>Đăng nhập</PageTitle>
      <div className="max-w-[480px]">
        <LoginForm next={safeNextPath(next)} />
      </div>
    </div>
  );
}
