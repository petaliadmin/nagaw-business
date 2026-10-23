import { roleHasPermission, type ResponsibilityDto } from '@nagaw/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button-link';
import { EmptyState } from '@/components/ui/empty-state';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { apiAsUser } from '@/lib/api/server';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { ResponsibilityList } from './responsibility-list';

export const metadata: Metadata = {
  title: 'Responsabilités — Nagaw Business',
};

async function Responsibilities({
  searchParams,
}: PageProps<'/espace/responsabilites'>) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;
  const canManage = roleHasPermission(
    organization.role,
    'responsibilities.manage',
  );
  const showArchived = (await searchParams).archives === '1';
  const responsibilities = await apiAsUser<ResponsibilityDto[]>(accessToken, {
    path: showArchived
      ? '/responsibilities?archives=true'
      : '/responsibilities',
    organizationId: organization.id,
  });

  return (
    <>
      <PageHeader
        title="Responsabilités"
        description="Délégations durables confiées aux agents : objectif, règles, déclenchement et critères de réussite."
        actions={
          canManage ? (
            <ButtonLink href="/espace/responsabilites/nouvelle">
              Nouvelle responsabilité
            </ButtonLink>
          ) : undefined
        }
      />
      <Alert>
        Les responsabilités se définissent et s’activent dès maintenant. Tout
        reste manuel : rien n’est déclenché automatiquement.
      </Alert>
      {!responsibilities.ok ? (
        <Alert tone="error">
          Responsabilités indisponibles : {responsibilities.message}
        </Alert>
      ) : responsibilities.data.length === 0 ? (
        <EmptyState title="Aucune responsabilité pour le moment">
          {canManage
            ? 'Confiez une première responsabilité à un agent.'
            : 'Les propriétaires et administrateurs définissent les responsabilités.'}
        </EmptyState>
      ) : (
        <ResponsibilityList
          responsibilities={responsibilities.data}
          label="Liste des responsabilités"
        />
      )}
      <Link
        href={
          showArchived
            ? '/espace/responsabilites'
            : '/espace/responsabilites?archives=1'
        }
        className="text-sm underline"
      >
        {showArchived
          ? 'Masquer les responsabilités archivées'
          : 'Afficher les responsabilités archivées'}
      </Link>
    </>
  );
}

export default function ResponsibilitiesPage(
  props: PageProps<'/espace/responsabilites'>,
) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Responsibilities {...props} />
    </Suspense>
  );
}
