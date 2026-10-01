import type { ButtonHTMLAttributes } from 'react';

type Variant = 'filled' | 'ghost';

// Dùng chung cho <button> và các pill-link (Link styled như nút).
export const BUTTON_CLASSES: Record<Variant, string> = {
  filled: 'bg-ink text-paper',
  ghost: 'border border-ink bg-paper text-ink',
};

const BASE =
  'inline-block rounded-full px-[24px] py-[14px] text-[13px] font-bold uppercase leading-none tracking-[0.03em] transition hover:scale-[1.03] disabled:opacity-50 disabled:hover:scale-100';

export function Button({
  variant = 'filled',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`${BASE} ${BUTTON_CLASSES[variant]} ${className}`} {...props} />;
}
