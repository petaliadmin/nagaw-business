import {
  roleHasPermission,
  type AuditLogDto,
  type MemberDto,
  type Paginated,
  type ResponsibilityDto,
  type TaskSummaryDto,
} from '@nagaw/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { Card, Stat } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { apiAsUser } from '@/lib/api/server';
import { formatDate, formatDateTime } from '@/lib/format';
import { ROLE_LABELS, auditActionLabel } from '@/lib/labels';
import { requireReadyWorkspace } from '@/lib/workspace/load';

export const metadata: Metadata = { title: 'Vue d’ensemble — Nagaw Business' };

async function Overview() {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;
  const canReadAudit = roleHasPermission(organization.role, 'audit.read');

  const [members, responsibilities, tasks, audit] = await Promise.all([
    apiAsUser<MemberDto[]>(accessToken, {
      path: '/organizations/current/members',
      organizationId: organization.id,
    }),
    apiAsUser<ResponsibilityDto[]>(accessToken, {
      path: '/responsibilities',
      organizationId: organization.id,
    }),
    apiAsUser<TaskSummaryDto>(accessToken, {
      path: '/tasks/summary',
      organizationId: organization.id,
    }),
    canReadAudit
      ? apiAsUser<Paginated<AuditLogDto>>(accessToken, {
          path: '/audit-logs?limit=5',
          organizationId: organization.id,
        })
      : null,
  ]);

  const activeMembers = members.ok
    ? members.data.filter((member) => member.status === 'active')
    : [];
  const emailById = new Map(
    members.ok ? members.data.map((m) => [m.userId, m.email]) : [],
  );

  return (
    <>
      <PageHeader
        title={organization.name}
        description={`Créée le ${formatDate(organization.createdAt, organization.timezone)}`}
      />

      <Card title="Votre organisation" titleId="org-summary">
        {members.ok ? (
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Stat label="Membres actifs" value={activeMembers.length} />
            <Stat
              label="Responsabilités actives"
              value={
                responsibilities.ok
                  ? responsibilities.data.filter((r) => r.status === 'active')
                      .length
                  : 'indisponible'
              }
            />
            <Stat label="Votre rôle" value={ROLE_LABELS[organization.role]} />
            <Stat
              label="Fuseau horaire · devise"
              value={`${organization.timezone} · ${organization.defaultCurrency}`}
            />
          </dl>
        ) : (
          <Alert tone="error">Membres indisponibles : {members.message}</Alert>
        )}
      </Card>

      <Card title="Tâches" titleId="task-summary">
        {tasks.ok ? (
          <div className="flex flex-col gap-3">
            <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Stat label="Mes tâches à traiter" value={tasks.data.mine} />
              <Stat label="En cours" value={tasks.data.inProgress} />
              <Stat label="Bloquées" value={tasks.data.blocked} />
              <Stat label="En retard" value={tasks.data.overdue} />
            </dl>
            <Link href="/espace/taches" className="text-sm underline">
              Voir les tâches
            </Link>
          </div>
        ) : (
          <Alert tone="error">Tâches indisponibles : {tasks.message}</Alert>
        )}
      </Card>

      <Card title="Activité récente" titleId="recent-activity">
        {!audit ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Votre rôle ne donne pas accès au journal d’audit.
          </p>
        ) : !audit.ok ? (
          <Alert tone="error">Activité indisponible : {audit.message}</Alert>
        ) : audit.data.data.length === 0 ? (
          <EmptyState title="Aucune activité pour le moment" />
        ) : (
          <div className="flex flex-col gap-3">
            <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
              {audit.data.data.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap justify-between gap-2 py-2 text-sm"
                >
                  <span>
                    {auditActionLabel(entry.action)}
                    {entry.actorId && emailById.has(entry.actorId) && (
                      <span className="text-zinc-600 dark:text-zinc-400">
                        {' '}
                        — {emailById.get(entry.actorId)}
                      </span>
                    )}
                  </span>
                  <time
                    dateTime={entry.createdAt}
                    className="text-zinc-600 dark:text-zinc-400"
                  >
                    {formatDateTime(entry.createdAt, organization.timezone)}
                  </time>
                </li>
              ))}
            </ul>
            <Link href="/espace/journal" className="text-sm underline">
              Voir tout le journal
            </Link>
          </div>
        )}
      </Card>
    </>
  );
}

export default function OverviewPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Overview />
    </Suspense>
  );
}
