import type { ReactNode } from 'react';

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-zinc-300 p-6 dark:border-zinc-700">
      <p className="font-medium">{title}</p>
      {children && (
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          {children}
        </div>
      )}
    </div>
  );
}
