import type { ReactNode } from 'react';

export function Card({
  title,
  titleId,
  children,
  className = '',
}: {
  title?: string;
  titleId?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={title ? titleId : undefined}
      className={`rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 ${className}`}
    >
      {title && (
        <h2 id={titleId} className="mb-3 font-medium">
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
    <div className="flex flex-col gap-1">
      <dt className="text-sm text-zinc-600 dark:text-zinc-400">{label}</dt>
      <dd className="text-xl font-semibold">{value}</dd>
    </div>
  );
}
