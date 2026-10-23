import { roleHasPermission } from '@nagaw/shared';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
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
      description="Créée en brouillon, puis activée une fois complète."
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
  const requested = (await searchParams).responsable;
  const defaultAssigneeId =
    typeof requested === 'string' &&
    data.members.some((member) => member.value === requested)
      ? requested
      : undefined;
  return (
    <>
      {header}
      <Card>
        <ResponsibilityForm
          organizationId={organization.id}
          caps={data.caps}
          members={data.members}
          defaultAssigneeId={defaultAssigneeId}
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
