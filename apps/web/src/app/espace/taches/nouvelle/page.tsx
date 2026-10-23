import { roleHasPermission } from '@nagaw/shared';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { loadTaskFormData } from '../form-data';
import { TaskForm } from '../task-forms';

export const metadata: Metadata = {
  title: 'Lancer une tâche — Nagaw Business',
};

async function NewTask({ searchParams }: PageProps<'/espace/taches/nouvelle'>) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken, me } = workspace;
  const header = (
    <PageHeader
      title="Lancer une tâche"
      description="Une tâche ponctuelle, ou liée à une responsabilité active. Elle est suivie et clôturée à la main."
    />
  );
  if (!roleHasPermission(organization.role, 'tasks.work')) {
    return (
      <>
        {header}
        <Alert>
          Votre rôle permet de consulter les tâches, pas d’en lancer.
        </Alert>
      </>
    );
  }
  const data = await loadTaskFormData(accessToken, organization, me.id);
  if (!data.ok) {
    return (
      <>
        {header}
        <Alert tone="error">Formulaire indisponible : {data.message}</Alert>
      </>
    );
  }
  const requested = (await searchParams).responsabilite;
  const responsibility = data.responsibilities.find(
    (option) => option.value === requested,
  );
  const preferredAssignee = responsibility?.assigneeUserId ?? me.id;
  return (
    <>
      {header}
      {!roleHasPermission(organization.role, 'tasks.manage') && (
        <Alert>
          Vous lancez des tâches pour vous-même, ponctuelles ou sur les
          responsabilités qui vous sont confiées.
        </Alert>
      )}
      <Card>
        <TaskForm
          organizationId={organization.id}
          members={data.members}
          responsibilities={data.responsibilities}
          defaultResponsibilityId={responsibility?.value}
          defaultAssigneeId={
            data.members.some((member) => member.value === preferredAssignee)
              ? preferredAssignee
              : undefined
          }
        />
      </Card>
    </>
  );
}

export default function NewTaskPage(
  props: PageProps<'/espace/taches/nouvelle'>,
) {
  return (
    <Suspense fallback={<PageFallback />}>
      <NewTask {...props} />
    </Suspense>
  );
}
