import Link from 'next/link';
import type { ComponentProps } from 'react';

const VARIANTS = {
  primary:
    'bg-emerald-700 text-white hover:bg-emerald-800 focus-visible:outline-emerald-700',
  secondary:
    'border border-zinc-300 hover:bg-zinc-50 focus-visible:outline-zinc-500 dark:border-zinc-700 dark:hover:bg-zinc-900',
} as const;

export function ButtonLink({
  variant = 'primary',
  className = '',
  ...props
}: ComponentProps<typeof Link> & { variant?: keyof typeof VARIANTS }) {
  return (
    <Link
      {...props}
      className={`inline-flex items-center rounded-md px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 ${VARIANTS[variant]} ${className}`}
    />
  );
}
