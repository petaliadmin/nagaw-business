import {
  canWorkOnTask,
  isTaskOpen,
  isTaskOverdue,
  roleHasPermission,
  type MemberDto,
  type TaskDto,
  type TaskHistoryEntryDto,
  type TaskNoteDto,
} from '@nagaw/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { apiAsUser } from '@/lib/api/server';
import { formatCalendarDate, formatDateTime, todayIn } from '@/lib/format';
import {
  auditActionLabel,
  TASK_OUTCOME_LABELS,
  TASK_STATUS_LABELS,
} from '@/lib/labels';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { TaskForm, TaskNoteForm, TaskStatusActions } from '../task-forms';

export const metadata: Metadata = { title: 'Tâche — Nagaw Business' };

const FIELD_LABELS: Record<string, string> = {
  assigneeUserId: 'personne en charge',
  title: 'titre',
  description: 'description',
  dueOn: 'échéance',
};

/** One readable line per history entry, from its audited metadata. */
function historyDetail(entry: TaskHistoryEntryDto): string | null {
  const { metadata } = entry;
  if (entry.action === 'task.status_changed') {
    const from = metadata.from as keyof typeof TASK_STATUS_LABELS;
    const to = metadata.to as keyof typeof TASK_STATUS_LABELS;
    const reason =
      typeof metadata.reason === 'string' && metadata.reason
        ? ` (${metadata.reason})`
        : '';
    return `${TASK_STATUS_LABELS[from] ?? from} → ${TASK_STATUS_LABELS[to] ?? to}${reason}`;
  }
  if (entry.action === 'task.updated') {
    const changes = Object.keys(
      (metadata.changes as Record<string, unknown> | undefined) ?? {},
    );
    return changes.length
      ? `Modifié : ${changes.map((field) => FIELD_LABELS[field] ?? field).join(', ')}`
      : null;
  }
  return null;
}

function Text({ value }: { value: string }) {
  return <dd className="break-words whitespace-pre-wrap">{value || '—'}</dd>;
}

async function Task({ params }: PageProps<'/espace/taches/[id]'>) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken, me } = workspace;
  const { id } = await params;
  const path = `/tasks/${encodeURIComponent(id)}`;
  const [task, notes, history] = await Promise.all([
    apiAsUser<TaskDto>(accessToken, { path, organizationId: organization.id }),
    apiAsUser<TaskNoteDto[]>(accessToken, {
      path: `${path}/notes`,
      organizationId: organization.id,
    }),
    apiAsUser<TaskHistoryEntryDto[]>(accessToken, {
      path: `${path}/history`,
      organizationId: organization.id,
    }),
  ]);

  if (!task.ok) {
    return (
      <>
        <PageHeader title="Tâche" />
        <Alert tone="error">
          {task.status === 404
            ? 'Cette tâche n’existe pas dans cette organisation.'
            : `Tâche indisponible : ${task.message}`}
        </Alert>
        <Link href="/espace/taches" className="text-sm underline">
          Retour aux tâches
        </Link>
      </>
    );
  }
  const data = task.data;
  const tz = organization.timezone;
  const open = isTaskOpen(data.status);
  const canWork =
    open &&
    canWorkOnTask(
      { userId: me.id, role: organization.role },
      { assigneeUserId: data.assignee.userId },
    );
  const canEdit = open && roleHasPermission(organization.role, 'tasks.manage');
  const members = canEdit
    ? await apiAsUser<MemberDto[]>(accessToken, {
        path: '/organizations/current/members',
        organizationId: organization.id,
      })
    : null;

  return (
    <>
      <PageHeader
        title={data.title}
        actions={
          <span className="flex flex-wrap gap-2">
            <Badge>{TASK_STATUS_LABELS[data.status]}</Badge>
            {isTaskOverdue(data, todayIn(tz)) && <Badge>En retard</Badge>}
          </span>
        }
      />
      <Link href="/espace/taches" className="text-sm underline">
        Retour aux tâches
      </Link>

      {data.status === 'blocked' && (
        <Alert tone="error">
          Bloquée : {data.blockedReason}
          {data.escalation
            ? ` Personne à prévenir : ${data.escalation.email}.`
            : ''}
        </Alert>
      )}

      <Card title="Résumé" titleId="task-summary">
        <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-zinc-600 dark:text-zinc-400">En charge</dt>
          <dd>
            {data.assignee.displayName ?? data.assignee.email}
            {data.assignee.status !== 'active' && ' (désactivé)'}
          </dd>
          <dt className="text-zinc-600 dark:text-zinc-400">Responsabilité</dt>
          <dd>
            {data.responsibility ? (
              <Link
                href={`/espace/responsabilites/${data.responsibility.id}`}
                className="underline"
              >
                {data.responsibility.title}
              </Link>
            ) : (
              'Tâche ponctuelle'
            )}
          </dd>
          <dt className="text-zinc-600 dark:text-zinc-400">Description</dt>
          <Text value={data.description} />
          <dt className="text-zinc-600 dark:text-zinc-400">Échéance</dt>
          <dd>{data.dueOn ? formatCalendarDate(data.dueOn) : 'Aucune'}</dd>
          <dt className="text-zinc-600 dark:text-zinc-400">Lancée</dt>
          <dd>
            {formatDateTime(data.createdAt, tz)} par {data.createdBy.email}
          </dd>
          {data.startedAt && (
            <>
              <dt className="text-zinc-600 dark:text-zinc-400">Démarrée</dt>
              <dd>{formatDateTime(data.startedAt, tz)}</dd>
            </>
          )}
          {data.completedAt && (
            <>
              <dt className="text-zinc-600 dark:text-zinc-400">Clôturée</dt>
              <dd>{formatDateTime(data.completedAt, tz)}</dd>
            </>
          )}
          {data.outcome && (
            <>
              <dt className="text-zinc-600 dark:text-zinc-400">Résultat</dt>
              <dd>{TASK_OUTCOME_LABELS[data.outcome]}</dd>
              <dt className="text-zinc-600 dark:text-zinc-400">Compte rendu</dt>
              <Text value={data.report} />
            </>
          )}
        </dl>
      </Card>

      {canWork && (
        <Card title="Avancement" titleId="task-progress">
          <TaskStatusActions organizationId={organization.id} task={data} />
        </Card>
      )}

      <Card title="Notes" titleId="task-notes">
        <div className="flex flex-col gap-4">
          {canWork && (
            <TaskNoteForm
              key={notes.ok ? notes.data.length : 0}
              organizationId={organization.id}
              taskId={data.id}
            />
          )}
          {!notes.ok ? (
            <Alert tone="error">Notes indisponibles : {notes.message}</Alert>
          ) : notes.data.length === 0 ? (
            <EmptyState title="Aucune note pour le moment" />
          ) : (
            <ol className="flex flex-col divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
              {notes.data.map((note) => (
                <li key={note.id} className="flex flex-col gap-0.5 py-2">
                  <p className="break-words whitespace-pre-wrap">{note.body}</p>
                  <span className="text-zinc-600 dark:text-zinc-400">
                    {note.author.email} ·{' '}
                    <time dateTime={note.createdAt}>
                      {formatDateTime(note.createdAt, tz)}
                    </time>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </Card>

      {canEdit && members && (
        <Card title="Modifier" titleId="task-edit">
          {members.ok ? (
            <TaskForm
              key={data.id}
              organizationId={organization.id}
              task={data}
              members={members.data
                .filter(
                  (member) =>
                    member.status === 'active' ||
                    member.userId === data.assignee.userId,
                )
                .map((member) => ({
                  value: member.userId,
                  label: member.displayName ?? member.email,
                }))}
            />
          ) : (
            <Alert tone="error">
              Formulaire indisponible : {members.message}
            </Alert>
          )}
        </Card>
      )}

      <Card title="Historique" titleId="task-history">
        {!history.ok ? (
          <Alert tone="error">
            Historique indisponible : {history.message}
          </Alert>
        ) : (
          <ol className="flex flex-col divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
            {history.data.map((entry) => {
              const detail = historyDetail(entry);
              return (
                <li key={entry.id} className="flex flex-col gap-0.5 py-2">
                  <span>
                    <span className="font-medium">
                      {auditActionLabel(entry.action)}
                    </span>
                    {entry.actor && ` — ${entry.actor.email}`}
                  </span>
                  {detail && <span className="break-words">{detail}</span>}
                  <time
                    dateTime={entry.createdAt}
                    className="text-zinc-600 dark:text-zinc-400"
                  >
                    {formatDateTime(entry.createdAt, tz)}
                  </time>
                </li>
              );
            })}
          </ol>
        )}
      </Card>
    </>
  );
}

export default function TaskPage(props: PageProps<'/espace/taches/[id]'>) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Task {...props} />
    </Suspense>
  );
}
