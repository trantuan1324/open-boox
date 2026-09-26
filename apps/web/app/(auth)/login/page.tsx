import { PageTitle } from '@/components/ui/page-title';
import { safeNextPath } from '@/lib/auth/route-access';
import { LoginForm } from './login-form';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="mx-auto flex max-w-md flex-col gap-10 px-4 py-16">
      <PageTitle>Đăng nhập</PageTitle>
      <LoginForm next={safeNextPath(next)} />
    </div>
  );
}
