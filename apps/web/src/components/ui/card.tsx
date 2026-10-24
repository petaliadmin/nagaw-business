import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function Card({
  title,
  titleId,
  icon: Icon,
  children,
  className = '',
}: {
  title?: string;
  titleId?: string;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={title ? titleId : undefined}
      className={`rounded-2xl border border-line bg-surface p-4 shadow-sm md:p-6 ${className}`}
    >
      {title && (
        <h2
          id={titleId}
          className="mb-4 flex items-center gap-2 text-xl font-bold"
        >
          {Icon && (
            <span className="flex size-9 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
              <Icon aria-hidden className="size-5" />
            </span>
          )}
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

/** A labelled figure. Only for values that come from real data. */
export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-surface-muted p-3">
      <dt className="text-base text-ink-muted">{label}</dt>
      <dd className="text-2xl font-extrabold tabular-nums">{value}</dd>
    </div>
  );
}
