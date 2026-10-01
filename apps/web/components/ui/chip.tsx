import Link from 'next/link';
import type { ReactNode } from 'react';

export function Chip({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={`rounded-full border border-ink px-[16px] py-[10px] text-[12px] font-bold uppercase leading-none tracking-[0.03em] transition hover:scale-[1.03] ${
        active ? 'bg-ink text-paper' : 'bg-paper text-ink'
      }`}
    >
      {children}
    </Link>
  );
}
