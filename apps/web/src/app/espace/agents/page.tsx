import {
  AGENT_ROLE_LABELS,
  roleHasPermission,
  type AgentDto,
  type AgentLimitsCaps,
} from '@nagaw/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button-link';
import { EmptyState } from '@/components/ui/empty-state';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { apiAsUser } from '@/lib/api/server';
import { formatDateTime } from '@/lib/format';
import { AGENT_STATUS_LABELS } from '@/lib/labels';
import { requireReadyWorkspace } from '@/lib/workspace/load';

export const metadata: Metadata = { title: 'Agents — Nagaw Business' };

async function Agents({ searchParams }: PageProps<'/espace/agents'>) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;
  const canManage = roleHasPermission(organization.role, 'agents.manage');
  const showArchived = (await searchParams).archives === '1';

  const [agents, limits] = await Promise.all([
    apiAsUser<AgentDto[]>(accessToken, {
      path: showArchived ? '/agents?archives=true' : '/agents',
      organizationId: organization.id,
    }),
    apiAsUser<AgentLimitsCaps>(accessToken, {
      path: '/agents/limits',
      organizationId: organization.id,
    }),
  ]);

  const usage =
    agents.ok && limits.ok
      ? `${agents.data.filter((a) => a.status !== 'archived').length} agent(s) sur ${limits.data.maxAgents} autorisés.`
      : undefined;

  return (
    <>
      <PageHeader
        title="Agents"
        description={
          usage
            ? `Collaborateurs numériques de ${organization.name}. ${usage}`
            : `Collaborateurs numériques de ${organization.name}.`
        }
        actions={
          canManage ? (
            <ButtonLink href="/espace/agents/nouveau">Nouvel agent</ButtonLink>
          ) : undefined
        }
      />
      <Alert>
        Aucun modèle d’IA n’est encore configuré sur la plateforme : les agents
        se configurent et se testent, mais n’exécutent pas encore de tâches.
      </Alert>
      {!agents.ok ? (
        <Alert tone="error">Agents indisponibles : {agents.message}</Alert>
      ) : agents.data.length === 0 ? (
        <EmptyState title="Aucun agent pour le moment">
          {canManage
            ? 'Créez un premier agent pour lui confier une responsabilité.'
            : 'Les propriétaires et administrateurs créent les agents.'}
        </EmptyState>
      ) : (
        <ul
          aria-label="Liste des agents"
          className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800"
        >
          {agents.data.map((agent) => (
            <li key={agent.id} className="flex flex-col gap-1 p-4">
              <span className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/espace/agents/${agent.id}`}
                  className="font-medium underline"
                >
                  {agent.name}
                </Link>
                <Badge>{AGENT_STATUS_LABELS[agent.status]}</Badge>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  {AGENT_ROLE_LABELS[agent.roleKey]} · version{' '}
                  {agent.currentVersion.version}
                </span>
              </span>
              {agent.description && (
                <span className="text-sm">{agent.description}</span>
              )}
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                Modifié le{' '}
                {formatDateTime(
                  agent.currentVersion.createdAt > agent.updatedAt
                    ? agent.currentVersion.createdAt
                    : agent.updatedAt,
                  organization.timezone,
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Link
        href={showArchived ? '/espace/agents' : '/espace/agents?archives=1'}
        className="text-sm underline"
      >
        {showArchived
          ? 'Masquer les agents archivés'
          : 'Afficher les agents archivés'}
      </Link>
    </>
  );
}

export default function AgentsPage(props: PageProps<'/espace/agents'>) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Agents {...props} />
    </Suspense>
  );
}
