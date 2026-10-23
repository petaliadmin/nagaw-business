import { roleHasPermission, type AgentLimitsCaps } from '@nagaw/shared';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { apiAsUser } from '@/lib/api/server';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { CreateAgentForm } from '../agent-forms';

export const metadata: Metadata = { title: 'Nouvel agent — Nagaw Business' };

async function NewAgent() {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;
  const header = (
    <PageHeader
      title="Nouvel agent"
      description="L’agent est créé en brouillon. Vous pourrez le tester, puis l’activer."
    />
  );
  if (!roleHasPermission(organization.role, 'agents.manage')) {
    return (
      <>
        {header}
        <Alert>
          Seuls les propriétaires et administrateurs peuvent créer un agent.
        </Alert>
      </>
    );
  }
  const limits = await apiAsUser<AgentLimitsCaps>(accessToken, {
    path: '/agents/limits',
    organizationId: organization.id,
  });
  return (
    <>
      {header}
      {limits.ok ? (
        <Card>
          <CreateAgentForm
            organizationId={organization.id}
            caps={limits.data}
          />
        </Card>
      ) : (
        <Alert tone="error">Limites indisponibles : {limits.message}</Alert>
      )}
    </>
  );
}

export default function NewAgentPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <NewAgent />
    </Suspense>
  );
}
