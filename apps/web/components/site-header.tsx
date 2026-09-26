import Link from 'next/link';
import { getCurrentUser } from '@/lib/api/server';

export async function SiteHeader() {
  const user = await getCurrentUser();
  return (
    <header className="flex items-center justify-between border-b border-dashed border-cork-border px-6 py-5">
      <Link href="/" className="text-[14px] font-medium uppercase">
        Open Boox
      </Link>
      <nav className="flex gap-6 text-[12px] font-medium uppercase">
        <Link href="/books">Sách</Link>
        {user ? (
          <>
            {user.role === 'ADMIN' && <Link href="/admin">Quản trị</Link>}
            <Link href="/account">Tài khoản</Link>
          </>
        ) : (
          <>
            <Link href="/login">Đăng nhập</Link>
            <Link href="/register">Đăng ký</Link>
          </>
        )}
      </nav>
    </header>
  );
}
