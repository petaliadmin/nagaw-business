import {
  canLaunchTask,
  roleHasPermission,
  type ResponsibilityDto,
  type ResponsibilityHistoryEntryDto,
  type TaskDto,
} from '@nagaw/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button-link';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { apiAsUser } from '@/lib/api/server';
import { formatDate, formatDateTime, todayIn } from '@/lib/format';
import { auditActionLabel, RESPONSIBILITY_STATUS_LABELS } from '@/lib/labels';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { TaskList } from '../../taches/task-list';
import { loadFormData } from '../form-data';
import {
  ResponsibilityForm,
  ResponsibilityStatusActions,
} from '../responsibility-forms';

export const metadata: Metadata = {
  title: 'Responsabilité — Nagaw Business',
};

const FIELD_LABELS: Record<string, string> = {
  assigneeUserId: 'personne responsable',
  title: 'titre',
  objective: 'objectif',
  scope: 'périmètre',
  rules: 'règles',
  successCriteria: 'critères de réussite',
  maxRunsPerDay: 'tâches par jour',
  escalationUserId: 'personne à prévenir',
  startsOn: 'début',
  endsOn: 'fin',
};

/** One readable line per history entry, from its audited metadata. */
function historyDetail(entry: ResponsibilityHistoryEntryDto): string | null {
  const { metadata } = entry;
  if (entry.action === 'responsibility.status_changed') {
    const from = metadata.from as keyof typeof RESPONSIBILITY_STATUS_LABELS;
    const to = metadata.to as keyof typeof RESPONSIBILITY_STATUS_LABELS;
    return `${RESPONSIBILITY_STATUS_LABELS[from] ?? from} → ${RESPONSIBILITY_STATUS_LABELS[to] ?? to}`;
  }
  if (entry.action === 'responsibility.updated') {
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
  return <dd className="whitespace-pre-wrap break-words">{value || '—'}</dd>;
}

async function Responsibility({
  params,
}: PageProps<'/espace/responsabilites/[id]'>) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken, me } = workspace;
  const { id } = await params;
  const canManage = roleHasPermission(
    organization.role,
    'responsibilities.manage',
  );
  const path = `/responsibilities/${encodeURIComponent(id)}`;
  const [responsibility, history, tasks] = await Promise.all([
    apiAsUser<ResponsibilityDto>(accessToken, {
      path,
      organizationId: organization.id,
    }),
    apiAsUser<ResponsibilityHistoryEntryDto[]>(accessToken, {
      path: `${path}/history`,
      organizationId: organization.id,
    }),
    apiAsUser<TaskDto[]>(accessToken, {
      path: `/tasks?responsibilityId=${encodeURIComponent(id)}`,
      organizationId: organization.id,
    }),
  ]);

  if (!responsibility.ok) {
    return (
      <>
        <PageHeader title="Responsabilité" />
        <Alert tone="error">
          {responsibility.status === 404
            ? 'Cette responsabilité n’existe pas dans cette organisation.'
            : `Responsabilité indisponible : ${responsibility.message}`}
        </Alert>
        <Link href="/espace/responsabilites" className="text-sm underline">
          Retour aux responsabilités
        </Link>
      </>
    );
  }
  const data = responsibility.data;
  const tz = organization.timezone;
  const editable = canManage && data.status !== 'archived';
  const today = todayIn(tz);
  // Tasks launched today count against the daily limit (organization time).
  const launchedToday = tasks.ok
    ? tasks.data.filter(
        (task) =>
          new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(
            new Date(task.createdAt),
          ) === today,
      ).length
    : null;
  const canLaunch =
    data.status === 'active' &&
    canLaunchTask(
      { userId: me.id, role: organization.role },
      { assigneeUserId: me.id },
      data.assignee.userId,
    );
  const formData = editable
    ? await loadFormData(accessToken, organization.id)
    : null;

  return (
    <>
      <PageHeader
        title={data.title}
        actions={<Badge>{RESPONSIBILITY_STATUS_LABELS[data.status]}</Badge>}
      />
      <Link href="/espace/responsabilites" className="text-sm underline">
        Retour aux responsabilités
      </Link>

      <Card title="Résumé" titleId="responsibility-summary">
        <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-zinc-600 dark:text-zinc-400">Responsable</dt>
          <dd>
            {data.assignee.displayName ?? data.assignee.email}
            {data.assignee.status !== 'active' && ' (désactivé)'}
          </dd>
          <dt className="text-zinc-600 dark:text-zinc-400">Objectif</dt>
          <Text value={data.objective} />
          <dt className="text-zinc-600 dark:text-zinc-400">Périmètre</dt>
          <Text value={data.scope} />
          <dt className="text-zinc-600 dark:text-zinc-400">Règles</dt>
          <Text value={data.rules} />
          <dt className="text-zinc-600 dark:text-zinc-400">
            Critères de réussite
          </dt>
          <Text value={data.successCriteria} />
          <dt className="text-zinc-600 dark:text-zinc-400">Déclenchement</dt>
          <dd>Manuel</dd>
          <dt className="text-zinc-600 dark:text-zinc-400">Limite</dt>
          <dd>{data.maxRunsPerDay} tâches par jour</dd>
          <dt className="text-zinc-600 dark:text-zinc-400">Escalade</dt>
          <dd>{data.escalation?.email ?? 'Personne'}</dd>
          <dt className="text-zinc-600 dark:text-zinc-400">Période</dt>
          <dd>
            {data.startsOn
              ? `Du ${formatDate(data.startsOn, 'UTC')}`
              : 'Dès l’activation'}
            {data.endsOn
              ? ` au ${formatDate(data.endsOn, 'UTC')}`
              : ', sans fin'}
          </dd>
        </dl>
        {canManage && (
          <div className="mt-4">
            <ResponsibilityStatusActions
              organizationId={organization.id}
              responsibility={data}
            />
          </div>
        )}
      </Card>

      <Card title="Tâches" titleId="responsibility-tasks">
        <div className="flex flex-col gap-3">
          {launchedToday !== null && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {launchedToday} / {data.maxRunsPerDay} tâches lancées aujourd’hui.
            </p>
          )}
          {canLaunch && (
            <div>
              <ButtonLink
                href={`/espace/taches/nouvelle?responsabilite=${data.id}`}
              >
                Lancer une tâche
              </ButtonLink>
            </div>
          )}
          {data.status !== 'active' && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Activez la responsabilité pour y lancer des tâches.
            </p>
          )}
          {!tasks.ok ? (
            <Alert tone="error">Tâches indisponibles : {tasks.message}</Alert>
          ) : tasks.data.length === 0 ? (
            <EmptyState title="Aucune tâche lancée pour le moment" />
          ) : (
            <TaskList
              tasks={tasks.data}
              label="Tâches de la responsabilité"
              today={today}
            />
          )}
        </div>
      </Card>

      {editable && formData && (
        <Card title="Modifier" titleId="responsibility-edit">
          {formData.ok ? (
            <ResponsibilityForm
              key={data.id}
              organizationId={organization.id}
              caps={formData.caps}
              members={formData.members}
              responsibility={data}
            />
          ) : (
            <Alert tone="error">
              Formulaire indisponible : {formData.message}
            </Alert>
          )}
        </Card>
      )}

      <Card title="Historique" titleId="responsibility-history">
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
                  {detail && <span>{detail}</span>}
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

export default function ResponsibilityPage(
  props: PageProps<'/espace/responsabilites/[id]'>,
) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Responsibility {...props} />
    </Suspense>
  );
}
