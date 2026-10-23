import {
  AGENT_ROLE_LABELS,
  ERROR_POLICY_LABELS,
  roleHasPermission,
  TOOL_REGISTRY,
  type AgentDto,
  type AgentLimitsCaps,
  type AgentVersionDto,
} from '@nagaw/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, Stat } from '@/components/ui/card';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { apiAsUser } from '@/lib/api/server';
import { formatDateTime } from '@/lib/format';
import { AGENT_STATUS_LABELS } from '@/lib/labels';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import {
  ConfigurationForm,
  IdentityForm,
  StatusActions,
  TestPanel,
} from '../agent-forms';

export const metadata: Metadata = { title: 'Agent — Nagaw Business' };

function VersionSummary({ version }: { version: AgentVersionDto }) {
  const tools = version.tools.length
    ? version.tools.map((tool) => TOOL_REGISTRY[tool].label).join(', ')
    : 'aucun';
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
      <dt className="text-zinc-600 dark:text-zinc-400">Objectifs</dt>
      <dd className="whitespace-pre-wrap break-words">
        {version.objectives || '—'}
      </dd>
      <dt className="text-zinc-600 dark:text-zinc-400">Instructions</dt>
      <dd className="whitespace-pre-wrap break-words">
        {version.instructions || '—'}
      </dd>
      <dt className="text-zinc-600 dark:text-zinc-400">Limites</dt>
      <dd>
        {version.maxSteps} étapes, {version.maxDurationSeconds} secondes
      </dd>
      <dt className="text-zinc-600 dark:text-zinc-400">En cas d’erreur</dt>
      <dd>{ERROR_POLICY_LABELS[version.errorPolicy]}</dd>
      <dt className="text-zinc-600 dark:text-zinc-400">Outils</dt>
      <dd>{tools}</dd>
    </dl>
  );
}

async function Agent({ params }: PageProps<'/espace/agents/[id]'>) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;
  const { id } = await params;
  const canManage = roleHasPermission(organization.role, 'agents.manage');
  const path = `/agents/${encodeURIComponent(id)}`;

  const [agent, versions, limits] = await Promise.all([
    apiAsUser<AgentDto>(accessToken, { path, organizationId: organization.id }),
    apiAsUser<AgentVersionDto[]>(accessToken, {
      path: `${path}/versions`,
      organizationId: organization.id,
    }),
    apiAsUser<AgentLimitsCaps>(accessToken, {
      path: '/agents/limits',
      organizationId: organization.id,
    }),
  ]);

  if (!agent.ok) {
    return (
      <>
        <PageHeader title="Agent" />
        <Alert tone="error">
          {agent.status === 404
            ? 'Cet agent n’existe pas dans cette organisation.'
            : `Agent indisponible : ${agent.message}`}
        </Alert>
        <Link href="/espace/agents" className="text-sm underline">
          Retour aux agents
        </Link>
      </>
    );
  }
  const data = agent.data;
  const editable = canManage && data.status !== 'archived';

  return (
    <>
      <PageHeader
        title={data.name}
        description={data.description || undefined}
        actions={<Badge>{AGENT_STATUS_LABELS[data.status]}</Badge>}
      />
      <Link href="/espace/agents" className="text-sm underline">
        Retour aux agents
      </Link>

      <Card title="Résumé" titleId="agent-summary">
        <dl className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat label="Domaine" value={AGENT_ROLE_LABELS[data.roleKey]} />
          <Stat label="Version" value={data.currentVersion.version} />
          <Stat label="Modèle d’IA" value="Non configuré" />
        </dl>
        <VersionSummary version={data.currentVersion} />
        {canManage && (
          <div className="mt-4">
            <StatusActions organizationId={organization.id} agent={data} />
          </div>
        )}
      </Card>

      <Card title="Test contrôlé" titleId="agent-test">
        <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
          Vérifie la configuration actuelle et affiche les consignes que l’agent
          recevrait. Aucun modèle d’IA n’est appelé et aucune action n’est
          exécutée.
        </p>
        <TestPanel organizationId={organization.id} agentId={data.id} />
      </Card>

      {editable && limits.ok && (
        <>
          <Card title="Configuration" titleId="agent-configuration">
            <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
              Chaque enregistrement crée une nouvelle version ; les versions
              précédentes restent consultables.
            </p>
            <ConfigurationForm
              organizationId={organization.id}
              agent={data}
              caps={limits.data}
            />
          </Card>
          <Card title="Identité" titleId="agent-identity">
            <IdentityForm organizationId={organization.id} agent={data} />
          </Card>
        </>
      )}
      {editable && !limits.ok && (
        <Alert tone="error">Limites indisponibles : {limits.message}</Alert>
      )}

      <Card title="Historique des versions" titleId="agent-versions">
        {!versions.ok ? (
          <Alert tone="error">
            Historique indisponible : {versions.message}
          </Alert>
        ) : (
          <ol className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
            {versions.data.map((version) => (
              <li key={version.id} className="py-3 first:pt-0 last:pb-0">
                <details>
                  <summary className="cursor-pointer text-sm">
                    <span className="font-medium">
                      Version {version.version}
                    </span>
                    {version.id === data.currentVersion.id && ' (actuelle)'} —{' '}
                    {formatDateTime(version.createdAt, organization.timezone)},
                    par {version.createdBy.email}
                  </summary>
                  <div className="mt-2">
                    <VersionSummary version={version} />
                  </div>
                </details>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </>
  );
}

export default function AgentPage(props: PageProps<'/espace/agents/[id]'>) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Agent {...props} />
    </Suspense>
  );
}
