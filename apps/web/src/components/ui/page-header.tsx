import type { ReactNode } from 'react';

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">
          {title}
        </h1>
        {description && <p className="text-ink-muted">{description}</p>}
      </div>
      {actions}
    </header>
  );
}
