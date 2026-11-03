import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { MODULE_TONES, type ModuleTone } from '@/components/dashboard/tones';
import { Figure } from './figure';

export function Card({
  title,
  titleId,
  icon: Icon,
  tone,
  action,
  children,
  className = '',
}: {
  title?: string;
  titleId?: string;
  icon?: LucideIcon;
  /** Module colour of the icon (brand by default). */
  tone?: ModuleTone;
  /** A link beside the title, such as « Tout voir ». */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={title ? titleId : undefined}
      className={`rounded-2xl border border-line bg-surface p-4 shadow-sm md:p-6 ${className}`}
    >
      {title && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3">
          <h2
            id={titleId}
            className="flex items-center gap-2 text-xl font-bold"
          >
            {Icon && (
              <span
                className={`flex size-9 items-center justify-center rounded-xl ${
                  tone
                    ? MODULE_TONES[tone].badge
                    : 'bg-brand-soft text-brand-ink'
                }`}
              >
                <Icon aria-hidden className="size-5" />
              </span>
            )}
            {title}
          </h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** A labelled figure. Only for values that come from real data. */
export function Stat({
  label,
  value,
  className = '',
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`@container flex min-w-0 flex-col gap-1 rounded-xl bg-surface-muted p-3 ${className}`}
    >
      <dt className="text-base text-ink-muted">{label}</dt>
      <dd className="font-extrabold tabular-nums">
        <Figure value={value} />
      </dd>
    </div>
  );
}
