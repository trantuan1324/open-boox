import type { ButtonHTMLAttributes } from 'react';

type Variant = 'filled' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  filled: 'rounded-[36px] bg-bark-brown px-6 py-3.5',
  ghost: 'rounded-[22.5px] border border-warm-cream px-5 py-2',
};

export function Button({
  variant = 'filled',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`text-[14px] font-medium uppercase leading-none text-warm-cream disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
