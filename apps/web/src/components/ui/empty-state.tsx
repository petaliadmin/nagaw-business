import type { ReactNode } from 'react';

/** Never a dead end: an empty screen says what to do next (DESIGN.md). */
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-2xl border-2 border-dashed border-line-strong p-6">
      <p className="text-lg font-bold">{title}</p>
      {children && <div className="text-base text-ink-muted">{children}</div>}
    </div>
  );
}
