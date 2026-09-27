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
    <div className="flex flex-col gap-2">
      <label htmlFor={selectId} className="text-[12px] font-medium uppercase">
        {label}
      </label>
      <select
        ref={ref}
        id={selectId}
        aria-invalid={Boolean(error)}
        className="rounded-none border-0 border-b border-warm-cream bg-transparent px-0.5 py-1 text-[16px] outline-none focus:border-ember-accent"
        {...props}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option} value={option} className="bg-bark-brown">
            {option}
          </option>
        ))}
      </select>
      {error && <p className="text-[12px] text-ember-accent">{error}</p>}
    </div>
  );
});
