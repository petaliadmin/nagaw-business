import {
  roleHasPermission,
  type AuditLogDto,
  type MemberDto,
  type Paginated,
} from '@nagaw/shared';
import { History, Store, UserPlus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button-link';
import { Card, Stat } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { apiAsUser } from '@/lib/api/server';
import { formatDate, formatDateTime } from '@/lib/format';
import { ROLE_LABELS, auditActionLabel } from '@/lib/labels';
import { requireReadyWorkspace } from '@/lib/workspace/load';

export const metadata: Metadata = { title: 'Accueil — Nagaw Business' };

async function Overview() {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;
  const canReadAudit = roleHasPermission(organization.role, 'audit.read');
  const canInvite = roleHasPermission(organization.role, 'members.invite');

  const [members, audit] = await Promise.all([
    apiAsUser<MemberDto[]>(accessToken, {
      path: '/organizations/current/members',
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
        description={`Boutique créée le ${formatDate(organization.createdAt, organization.timezone)}`}
        actions={
          canInvite ? (
            <ButtonLink href="/espace/equipe">
              <UserPlus aria-hidden className="size-5" />
              Inviter quelqu’un
            </ButtonLink>
          ) : undefined
        }
      />

      <Card title="Votre boutique" titleId="org-summary" icon={Store}>
        {members.ok ? (
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Stat
              label="Personnes dans l’équipe"
              value={activeMembers.length}
            />
            <Stat label="Votre rôle" value={ROLE_LABELS[organization.role]} />
            <Stat
              label="Fuseau horaire · devise"
              value={`${organization.timezone} · ${organization.defaultCurrency}`}
            />
          </dl>
        ) : (
          <Alert tone="error">Équipe indisponible : {members.message}</Alert>
        )}
      </Card>

      <Card title="Activité récente" titleId="recent-activity" icon={History}>
        {!audit ? (
          <p className="text-ink-muted">
            Votre rôle ne donne pas accès à l’historique.
          </p>
        ) : !audit.ok ? (
          <Alert tone="error">Activité indisponible : {audit.message}</Alert>
        ) : audit.data.data.length === 0 ? (
          <EmptyState title="Aucune activité pour le moment" />
        ) : (
          <div className="flex flex-col gap-3">
            <ul className="flex flex-col divide-y divide-line">
              {audit.data.data.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-3 first:pt-0"
                >
                  <span className="font-semibold">
                    {auditActionLabel(entry.action)}
                    {entry.actorId && emailById.has(entry.actorId) && (
                      <span className="font-normal text-ink-muted">
                        {' '}
                        — {emailById.get(entry.actorId)}
                      </span>
                    )}
                  </span>
                  <time
                    dateTime={entry.createdAt}
                    className="text-ink-muted tabular-nums"
                  >
                    {formatDateTime(entry.createdAt, organization.timezone)}
                  </time>
                </li>
              ))}
            </ul>
            <Link
              href="/espace/journal"
              className="inline-flex min-h-12 items-center font-bold text-brand-ink underline underline-offset-4"
            >
              Voir tout l’historique
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
