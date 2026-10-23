import {
  roleHasPermission,
  type AuditLogDto,
  type MemberDto,
  type Paginated,
} from '@nagaw/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { Table } from '@/components/ui/table';
import { apiAsUser } from '@/lib/api/server';
import { formatDateTime } from '@/lib/format';
import { auditActionLabel } from '@/lib/labels';
import { requireReadyWorkspace } from '@/lib/workspace/load';

export const metadata: Metadata = { title: 'Journal d’audit — Nagaw Business' };

const PAGE_SIZE = 25;

async function AuditLog({ searchParams }: PageProps<'/espace/journal'>) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;

  const header = (
    <PageHeader
      title="Journal d’audit"
      description="Historique immuable des actions effectuées dans l’organisation."
    />
  );
  if (!roleHasPermission(organization.role, 'audit.read')) {
    return (
      <>
        {header}
        <Alert>Votre rôle ne donne pas accès au journal d’audit.</Alert>
      </>
    );
  }

  const before = (await searchParams).avant;
  const cursor =
    typeof before === 'string' && /^\d{1,19}$/.test(before)
      ? before
      : undefined;
  const query = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (cursor) query.set('cursor', cursor);

  const [audit, members] = await Promise.all([
    apiAsUser<Paginated<AuditLogDto>>(accessToken, {
      path: `/audit-logs?${query}`,
      organizationId: organization.id,
    }),
    apiAsUser<MemberDto[]>(accessToken, {
      path: '/organizations/current/members',
      organizationId: organization.id,
    }),
  ]);
  const emailById = new Map(
    members.ok ? members.data.map((m) => [m.userId, m.email]) : [],
  );

  return (
    <>
      {header}
      {!audit.ok ? (
        <Alert tone="error">Journal indisponible : {audit.message}</Alert>
      ) : audit.data.data.length === 0 ? (
        <EmptyState title="Aucune entrée dans le journal" />
      ) : (
        <>
          <Table
            caption="Entrées du journal d’audit, de la plus récente à la plus ancienne"
            rows={audit.data.data}
            rowKey={(entry) => entry.id}
            columns={[
              {
                header: 'Date',
                cell: (entry) => (
                  <time dateTime={entry.createdAt}>
                    {formatDateTime(entry.createdAt, organization.timezone)}
                  </time>
                ),
              },
              {
                header: 'Action',
                cell: (entry) => auditActionLabel(entry.action),
              },
              {
                header: 'Auteur',
                cell: (entry) =>
                  entry.actorType !== 'user'
                    ? 'Système'
                    : ((entry.actorId && emailById.get(entry.actorId)) ??
                      'Ancien membre'),
              },
              {
                header: 'Référence',
                cell: (entry) => (
                  <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                    {entry.requestId ?? '—'}
                  </span>
                ),
              },
            ]}
          />
          <div className="flex gap-4 text-sm">
            {cursor && (
              <Link href="/espace/journal" className="underline">
                Revenir aux plus récentes
              </Link>
            )}
            {audit.data.nextCursor && (
              <Link
                href={`/espace/journal?avant=${audit.data.nextCursor}`}
                className="underline"
              >
                Entrées plus anciennes
              </Link>
            )}
          </div>
        </>
      )}
    </>
  );
}

export default function AuditLogPage(props: PageProps<'/espace/journal'>) {
  return (
    <Suspense fallback={<PageFallback />}>
      <AuditLog {...props} />
    </Suspense>
  );
}
