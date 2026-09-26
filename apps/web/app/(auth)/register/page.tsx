import { PageTitle } from '@/components/ui/page-title';
import { safeNextPath } from '@/lib/auth/route-access';
import { RegisterForm } from './register-form';

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="mx-auto flex max-w-md flex-col gap-10 px-4 py-16">
      <PageTitle>Đăng ký</PageTitle>
      <RegisterForm next={safeNextPath(next)} />
    </div>
  );
}
