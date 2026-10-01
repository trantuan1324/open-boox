import Link from 'next/link';
import type { ReactNode } from 'react';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="sheet mx-auto flex w-full max-w-6xl flex-col gap-[31px] px-[20px] py-[48px] md:flex-row md:gap-[41px] md:px-[48px] md:py-[72px]">
      <nav
        aria-label="Quản trị"
        className="flex shrink-0 flex-wrap gap-[18px] text-[12px] font-bold uppercase tracking-[0.03em] md:w-[160px] md:flex-col"
      >
        <Link href="/admin/orders">Đơn hàng</Link>
        <Link href="/admin/shipments">Giao hàng</Link>
        <Link href="/admin/loans">Mượn sách</Link>
        <Link href="/admin/books">Sách</Link>
      </nav>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
