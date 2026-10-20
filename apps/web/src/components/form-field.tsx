import type { InputHTMLAttributes } from 'react';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
  error?: string;
}

export function FormField({ label, name, error, ...input }: FormFieldProps) {
  const errorId = error ? `${name}-error` : undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 aria-[invalid]:border-red-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        {...input}
      />
      {error && (
        <p id={errorId} className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
