import { forwardRef, type SelectHTMLAttributes } from 'react';

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  options: readonly string[];
  placeholder?: string;
};

export const SelectField = forwardRef<HTMLSelectElement, Props>(function SelectField(
  { label, error, options, placeholder, id, ...props },
  ref,
) {
  const selectId = id ?? props.name;
  return (
    <div className="flex flex-col gap-[8px]">
      <label htmlFor={selectId} className="text-[12px] font-bold uppercase tracking-[0.03em]">
        {label}
      </label>
      <select
        ref={ref}
        id={selectId}
        aria-invalid={Boolean(error)}
        className="rounded-[16px] border border-ink bg-paper px-[16px] py-[12px] text-[16px]"
        {...props}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {error && <p className="text-[12px] font-medium text-ember">{error}</p>}
    </div>
  );
});
