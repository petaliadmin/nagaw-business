import type { ResponsibilityDto } from '@nagaw/shared';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { RESPONSIBILITY_STATUS_LABELS } from '@/lib/labels';

/** List of responsibilities with their person in charge. */
export function ResponsibilityList({
  responsibilities,
  label,
}: {
  responsibilities: ResponsibilityDto[];
  label: string;
}) {
  return (
    <ul
      aria-label={label}
      className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800"
    >
      {responsibilities.map((responsibility) => (
        <li key={responsibility.id} className="flex flex-col gap-1 p-4">
          <span className="flex flex-wrap items-center gap-2">
            <Link
              href={`/espace/responsabilites/${responsibility.id}`}
              className="font-medium underline"
            >
              {responsibility.title}
            </Link>
            <Badge>{RESPONSIBILITY_STATUS_LABELS[responsibility.status]}</Badge>
          </span>
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            Confiée à{' '}
            {responsibility.assignee.displayName ??
              responsibility.assignee.email}
          </span>
        </li>
      ))}
    </ul>
  );
}
