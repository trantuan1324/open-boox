import { PageTitle } from '@/components/ui/page-title';
import { safeNextPath } from '@/lib/auth/route-access';
import { RegisterForm } from './register-form';

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="sheet sheet-pad flex w-full flex-col gap-10">
      <PageTitle>Đăng ký</PageTitle>
      <div className="max-w-[480px]">
        <RegisterForm next={safeNextPath(next)} />
      </div>
    </div>
  );
}
