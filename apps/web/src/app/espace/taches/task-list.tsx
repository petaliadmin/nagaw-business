import { isTaskOverdue, type TaskDto } from '@nagaw/shared';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { formatCalendarDate } from '@/lib/format';
import { TASK_STATUS_LABELS } from '@/lib/labels';

/** Tasks with their status, person in charge and due date. */
export function TaskList({
  tasks,
  label,
  today,
}: {
  tasks: TaskDto[];
  label: string;
  /** YYYY-MM-DD in the organization's time zone. */
  today: string;
}) {
  return (
    <ul
      aria-label={label}
      className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800"
    >
      {tasks.map((task) => (
        <li key={task.id} className="flex flex-col gap-1 p-4">
          <span className="flex flex-wrap items-center gap-2">
            <Link
              href={`/espace/taches/${task.id}`}
              className="font-medium break-words underline"
            >
              {task.title}
            </Link>
            <Badge>{TASK_STATUS_LABELS[task.status]}</Badge>
            {isTaskOverdue(task, today) && <Badge>En retard</Badge>}
          </span>
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            {task.assignee.displayName ?? task.assignee.email}
            {task.responsibility
              ? ` · ${task.responsibility.title}`
              : ' · Tâche ponctuelle'}
            {task.dueOn && ` · Échéance ${formatCalendarDate(task.dueOn)}`}
          </span>
        </li>
      ))}
    </ul>
  );
}
