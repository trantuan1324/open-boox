import type { ReactNode } from 'react';

export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="display text-[44px] md:text-[64px]">{children}</h1>;
}
