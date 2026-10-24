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
import { buttonClasses } from '@/components/ui/button-styles';
import { EmptyState } from '@/components/ui/empty-state';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { Table } from '@/components/ui/table';
import { apiAsUser } from '@/lib/api/server';
import { formatDateTime } from '@/lib/format';
import { auditActionLabel } from '@/lib/labels';
import { requireReadyWorkspace } from '@/lib/workspace/load';

export const metadata: Metadata = { title: 'Historique — Nagaw Business' };

const PAGE_SIZE = 25;

async function AuditLog({ searchParams }: PageProps<'/espace/journal'>) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;

  const header = (
    <PageHeader
      title="Historique"
      description="Tout ce qui a été fait dans la boutique, et par qui. Rien ne peut y être effacé."
    />
  );
  if (!roleHasPermission(organization.role, 'audit.read')) {
    return (
      <>
        {header}
        <Alert>Votre rôle ne donne pas accès à l’historique.</Alert>
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
        <Alert tone="error">Historique indisponible : {audit.message}</Alert>
      ) : audit.data.data.length === 0 ? (
        <EmptyState title="Rien dans l’historique pour le moment" />
      ) : (
        <>
          <Table
            caption="Historique de la boutique, du plus récent au plus ancien"
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
                header: 'Par',
                cell: (entry) =>
                  entry.actorType !== 'user'
                    ? 'Système'
                    : ((entry.actorId && emailById.get(entry.actorId)) ??
                      'Ancienne personne de l’équipe'),
              },
              {
                header: 'Référence',
                cell: (entry) => (
                  <span className="font-mono text-base text-ink-muted">
                    {entry.requestId ?? '—'}
                  </span>
                ),
              },
            ]}
          />
          <div className="flex flex-wrap gap-3">
            {cursor && (
              <Link
                href="/espace/journal"
                className={buttonClasses('secondary')}
              >
                Revenir aux plus récentes
              </Link>
            )}
            {audit.data.nextCursor && (
              <Link
                href={`/espace/journal?avant=${audit.data.nextCursor}`}
                className={buttonClasses('secondary')}
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
