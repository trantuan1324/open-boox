import Link from 'next/link';
import type { ReactNode } from 'react';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-[31px] px-[24px] py-[41px] md:flex-row md:gap-[41px]">
      <nav aria-label="Quản trị" className="flex shrink-0 gap-[18px] text-[12px] font-medium uppercase md:w-[160px] md:flex-col">
        <Link href="/admin/orders">Đơn hàng</Link>
        <Link href="/admin/shipments">Giao hàng</Link>
        <Link href="/admin/books">Sách</Link>
      </nav>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
