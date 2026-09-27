import Link from 'next/link';
import type { ReactNode } from 'react';

export function Chip({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={`rounded-[36px] border border-dashed border-cork-border px-[14px] py-[8px] text-[12px] font-medium uppercase ${active ? 'bg-bark-brown' : ''}`}
    >
      {children}
    </Link>
  );
}
