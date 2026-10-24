import type { ReactNode } from 'react';

const TONES = {
  neutral: 'bg-surface-muted text-ink',
  brand: 'bg-brand-soft text-brand-ink',
  success: 'bg-sales-soft text-sales-ink',
  warning: 'bg-warning-soft text-warning-ink',
  danger: 'bg-danger-soft text-danger-ink',
} as const;

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: keyof typeof TONES;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-0.5 text-base font-semibold ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
