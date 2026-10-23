'use client';

import { useFormStatus } from 'react-dom';

const VARIANTS = {
  primary:
    'bg-emerald-700 px-4 py-2 text-white hover:bg-emerald-800 focus-visible:outline-emerald-700',
  secondary:
    'border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 focus-visible:outline-zinc-500 dark:border-zinc-700 dark:hover:bg-zinc-900',
} as const;

export function SubmitButton({
  children,
  pendingLabel,
  variant = 'primary',
  'aria-label': ariaLabel,
}: {
  children: string;
  pendingLabel: string;
  variant?: keyof typeof VARIANTS;
  'aria-label'?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      aria-label={ariaLabel}
      className={`rounded-md font-medium focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60 ${VARIANTS[variant]}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
