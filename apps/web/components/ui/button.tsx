import type { ButtonHTMLAttributes } from 'react';

type Variant = 'filled' | 'ghost';

// Dùng chung cho <button> và các pill-link (Link styled như nút).
// Hover đảo màu với ease bounce của landing (0.5s) + nhấc nhẹ 2px.
export const BUTTON_CLASSES: Record<Variant, string> = {
  filled: 'bg-ink text-paper hover:bg-paper hover:text-ink',
  ghost: 'border border-ink bg-paper text-ink hover:bg-ink hover:text-paper',
};

const BASE =
  'inline-block rounded-full px-[24px] py-[14px] text-[13px] font-bold uppercase leading-none tracking-[0.03em] transition-all duration-500 ease-bounce hover:-translate-y-[2px] disabled:opacity-50 disabled:hover:translate-y-0';

export function Button({
  variant = 'filled',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`${BASE} ${BUTTON_CLASSES[variant]} ${className}`} {...props} />;
}
