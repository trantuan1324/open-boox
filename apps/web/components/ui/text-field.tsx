import { forwardRef, type InputHTMLAttributes } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string };

export const TextField = forwardRef<HTMLInputElement, Props>(function TextField({ label, error, id, ...props }, ref) {
  const inputId = id ?? props.name;
  return (
    <div className="flex flex-col gap-[8px]">
      <label htmlFor={inputId} className="text-[12px] font-bold uppercase tracking-[0.03em]">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={Boolean(error)}
        className="rounded-full border border-ink bg-paper px-[20px] py-[12px] text-[16px]"
        {...props}
      />
      {error && <p className="text-[12px] font-medium text-ember">{error}</p>}
    </div>
  );
});
