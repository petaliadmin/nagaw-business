import {
  memberChangeRefusal,
  roleHasPermission,
  ROLES,
  type InvitationDto,
  type MemberDto,
} from '@nagaw/shared';
import { Mail, UserPlus } from 'lucide-react';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { Table, type Column } from '@/components/ui/table';
import { apiAsUser } from '@/lib/api/server';
import { formatDate, formatDateTime } from '@/lib/format';
import {
  INVITATION_STATUS_LABELS,
  MEMBER_STATUS_LABELS,
  ROLE_LABELS,
} from '@/lib/labels';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { InviteForm } from './invite-form';
import { MemberActions, RevokeInvitationButton } from './member-actions';

export const metadata: Metadata = { title: 'Équipe — Nagaw Business' };

async function Team() {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken, me } = workspace;
  const canManage = roleHasPermission(organization.role, 'members.manage');
  const canInvite = roleHasPermission(organization.role, 'members.invite');

  const [members, invitations] = await Promise.all([
    apiAsUser<MemberDto[]>(accessToken, {
      path: '/organizations/current/members',
      organizationId: organization.id,
    }),
    canInvite
      ? apiAsUser<InvitationDto[]>(accessToken, {
          path: '/organizations/current/invitations',
          organizationId: organization.id,
        })
      : null,
  ]);

  const actor = { userId: me.id, role: organization.role };
  // Roles this actor may grant to someone else (owners only grant ownership).
  const assignableRoles = ROLES.filter(
    (role) =>
      memberChangeRefusal(actor, { userId: '', role: 'member' }, { role }) ===
      null,
  );

  const memberColumns: Column<MemberDto>[] = [
    {
      header: 'Personne',
      cell: (member) => (
        <div className="flex flex-col">
          <span className="font-semibold">
            {member.displayName ?? member.email}
            {member.userId === me.id && ' (vous)'}
          </span>
          {member.displayName && (
            <span className="text-ink-muted">{member.email}</span>
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
      header: 'Depuis le',
      cell: (member) => formatDate(member.joinedAt, organization.timezone),
    },
  ];
  if (canManage) {
    memberColumns.push({
      header: 'Actions',
      cell: (member) =>
        memberChangeRefusal(actor, member, {}) === null ? (
          <MemberActions
            organizationId={organization.id}
            member={member}
            assignableRoles={assignableRoles}
          />
        ) : (
          <span className="text-ink-muted">—</span>
        ),
    });
  }

  return (
    <>
      <PageHeader
        title="Équipe"
        description={
          canManage
            ? `Les personnes qui travaillent à ${organization.name}, leur rôle et leur accès.`
            : `Les personnes qui travaillent à ${organization.name}. Seuls le propriétaire et les gérants gèrent l’équipe.`
        }
      />
      {members.ok ? (
        <Table
          caption={`Équipe de ${organization.name}`}
          rows={members.data}
          rowKey={(member) => member.userId}
          columns={memberColumns}
        />
      ) : (
        <Alert tone="error">Équipe indisponible : {members.message}</Alert>
      )}

      {canInvite && (
        <Card title="Inviter un collaborateur" titleId="invite" icon={UserPlus}>
          <InviteForm
            organizationId={organization.id}
            timeZone={organization.timezone}
          />
        </Card>
      )}

      {invitations && (
        <Card
          title="Invitations en attente"
          titleId="pending-invitations"
          icon={Mail}
        >
          {!invitations.ok ? (
            <Alert tone="error">
              Invitations indisponibles : {invitations.message}
            </Alert>
          ) : invitations.data.length === 0 ? (
            <EmptyState title="Aucune invitation en attente" />
          ) : (
            <ul
              aria-label="Invitations en attente"
              className="divide-y divide-line"
            >
              {invitations.data.map((invitation) => (
                <li
                  key={invitation.id}
                  className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 flex-col gap-1 text-base">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium break-all">
                        {invitation.email}
                      </span>
                      <Badge>{ROLE_LABELS[invitation.role]}</Badge>
                      {invitation.status !== 'pending' && (
                        <Badge>
                          {INVITATION_STATUS_LABELS[invitation.status]}
                        </Badge>
                      )}
                    </span>
                    <span className="text-ink-muted">
                      Invité par {invitation.invitedBy.email} · expire le{' '}
                      {formatDateTime(
                        invitation.expiresAt,
                        organization.timezone,
                      )}
                    </span>
                  </div>
                  <RevokeInvitationButton
                    organizationId={organization.id}
                    invitationId={invitation.id}
                    email={invitation.email}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>
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
