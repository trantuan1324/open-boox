import type { ReactNode } from 'react';

export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="text-[41px] font-medium uppercase leading-[0.9]">{children}</h1>;
}
