import type { ReactNode } from 'react';

// Tiêu đề trang cỡ display như tiêu đề section của landing, thu nhỏ còn vừa trang nội dung.
export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="display text-[clamp(48px,8vw,112px)]">{children}</h1>;
}
