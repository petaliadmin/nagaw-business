import { roleHasPermission } from '@nagaw/shared';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button-link';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { loadFormData } from '../form-data';
import { ResponsibilityForm } from '../responsibility-forms';

export const metadata: Metadata = {
  title: 'Nouvelle responsabilité — Nagaw Business',
};

async function NewResponsibility({
  searchParams,
}: PageProps<'/espace/responsabilites/nouvelle'>) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;
  const header = (
    <PageHeader
      title="Nouvelle responsabilité"
      description="Créée en brouillon ; elle pourra être activée quand son agent sera actif."
    />
  );
  if (!roleHasPermission(organization.role, 'responsibilities.manage')) {
    return (
      <>
        {header}
        <Alert>
          Seuls les propriétaires et administrateurs peuvent définir une
          responsabilité.
        </Alert>
      </>
    );
  }
  const data = await loadFormData(accessToken, organization.id);
  if (!data.ok) {
    return (
      <>
        {header}
        <Alert tone="error">Formulaire indisponible : {data.message}</Alert>
      </>
    );
  }
  if (data.agents.length === 0) {
    return (
      <>
        {header}
        <EmptyState title="Aucun agent disponible">
          Une responsabilité est confiée à un agent : créez d’abord un agent.
        </EmptyState>
        <div>
          <ButtonLink href="/espace/agents/nouveau">Créer un agent</ButtonLink>
        </div>
      </>
    );
  }
  const requested = (await searchParams).agent;
  const defaultAgentId =
    typeof requested === 'string' &&
    data.agents.some((agent) => agent.value === requested)
      ? requested
      : undefined;
  return (
    <>
      {header}
      <Card>
        <ResponsibilityForm
          organizationId={organization.id}
          caps={data.caps}
          agents={data.agents}
          members={data.members}
          defaultAgentId={defaultAgentId}
        />
      </Card>
    </>
  );
}

export default function NewResponsibilityPage(
  props: PageProps<'/espace/responsabilites/nouvelle'>,
) {
  return (
    <Suspense fallback={<PageFallback />}>
      <NewResponsibility {...props} />
    </Suspense>
  );
}
