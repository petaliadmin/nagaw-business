import type { MemberDto } from '@nagaw/shared';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { Table } from '@/components/ui/table';
import { apiAsUser } from '@/lib/api/server';
import { formatDate } from '@/lib/format';
import { MEMBER_STATUS_LABELS, ROLE_LABELS } from '@/lib/labels';
import { requireReadyWorkspace } from '@/lib/workspace/load';

export const metadata: Metadata = { title: 'Équipe — Nagaw Business' };

async function Team() {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;
  const members = await apiAsUser<MemberDto[]>(accessToken, {
    path: '/organizations/current/members',
    organizationId: organization.id,
  });

  return (
    <>
      <PageHeader
        title="Équipe"
        description={`Membres de ${organization.name}. Les invitations et la gestion des rôles arrivent dans une prochaine version.`}
      />
      {members.ok ? (
        <Table
          caption={`Membres de ${organization.name}`}
          rows={members.data}
          rowKey={(member) => member.userId}
          columns={[
            {
              header: 'Membre',
              cell: (member) => (
                <div className="flex flex-col">
                  <span className="font-medium">
                    {member.displayName ?? member.email}
                  </span>
                  {member.displayName && (
                    <span className="text-zinc-600 dark:text-zinc-400">
                      {member.email}
                    </span>
                  )}
                </div>
              ),
            },
            {
              header: 'Rôle',
              cell: (member) => <Badge>{ROLE_LABELS[member.role]}</Badge>,
            },
            {
              header: 'Statut',
              cell: (member) => MEMBER_STATUS_LABELS[member.status],
            },
            {
              header: 'Membre depuis',
              cell: (member) =>
                formatDate(member.joinedAt, organization.timezone),
            },
          ]}
        />
      ) : (
        <Alert tone="error">Membres indisponibles : {members.message}</Alert>
      )}
    </>
  );
}

export default function TeamPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Team />
    </Suspense>
  );
}
