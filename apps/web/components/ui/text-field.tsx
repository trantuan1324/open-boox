import { forwardRef, type InputHTMLAttributes } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string };

export const TextField = forwardRef<HTMLInputElement, Props>(function TextField({ label, error, id, ...props }, ref) {
  const inputId = id ?? props.name;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-[12px] font-medium uppercase">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={Boolean(error)}
        className="rounded-none border-0 border-b border-warm-cream bg-transparent px-0.5 py-1 text-[16px] outline-none focus:border-ember-accent"
        {...props}
      />
      {error && <p className="text-[12px] text-ember-accent">{error}</p>}
    </div>
  );
});
