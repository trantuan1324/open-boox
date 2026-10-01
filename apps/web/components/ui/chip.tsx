import Link from 'next/link';
import type { ReactNode } from 'react';

export function Chip({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={`rounded-full border border-ink px-[16px] py-[10px] text-[12px] font-bold uppercase leading-none tracking-[0.03em] transition-all duration-500 ease-bounce ${
        active ? 'bg-ink text-paper hover:bg-paper hover:text-ink' : 'bg-paper text-ink hover:bg-ink hover:text-paper'
      }`}
    >
      {children}
    </Link>
  );
}
