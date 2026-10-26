import type { InputHTMLAttributes } from 'react';

// 16 px text (no zoom on iOS focus), 48 px high, 3:1 border (DESIGN.md).
export const CONTROL =
  'min-h-12 w-full rounded-xl border-2 border-line-strong bg-surface px-4 py-2 text-base text-ink placeholder:text-ink-muted aria-[invalid]:border-danger';
const LABEL = 'text-base font-semibold';
const ERROR = 'text-base font-medium text-danger-ink';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
  /** Defaults to the name; set it when the same form repeats on a page. */
  id?: string;
  error?: string;
}

export function FormField({
  label,
  name,
  id = name,
  error,
  ...input
}: FormFieldProps) {
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={CONTROL}
        {...input}
      />
      {error && (
        <p id={errorId} className={ERROR}>
          {error}
        </p>
      )}
    </div>
  );
}

export function SelectField({
  label,
  name,
  id = name,
  defaultValue,
  options,
  error,
}: {
  label: string;
  name: string;
  id?: string;
  defaultValue: string;
  options: readonly { value: string; label: string }[];
  error?: string;
}) {
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={CONTROL}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={errorId} className={ERROR}>
          {error}
        </p>
      )}
    </div>
  );
}
