import { roleHasPermission, type TaskDto } from '@nagaw/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button-link';
import { EmptyState } from '@/components/ui/empty-state';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { apiAsUser } from '@/lib/api/server';
import { todayIn } from '@/lib/format';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { TaskList } from './task-list';

export const metadata: Metadata = { title: 'Tâches — Nagaw Business' };

function FilterLink({
  href,
  current,
  children,
}: {
  href: string;
  current: boolean;
  children: string;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? 'page' : undefined}
      className={`rounded-md px-3 py-1.5 text-sm ${current ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'underline'}`}
    >
      {children}
    </Link>
  );
}

async function Tasks({ searchParams }: PageProps<'/espace/taches'>) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken, me } = workspace;
  const params = await searchParams;
  const everyone = params.vue === 'toutes';
  const closed = params.statut === 'closes';
  const canLaunch = roleHasPermission(organization.role, 'tasks.work');

  const query = new URLSearchParams({ status: closed ? 'closed' : 'open' });
  if (!everyone) query.set('assigneeUserId', me.id);
  const tasks = await apiAsUser<TaskDto[]>(accessToken, {
    path: `/tasks?${query}`,
    organizationId: organization.id,
  });
  const href = (vue: boolean, statut: boolean) => {
    const next = new URLSearchParams();
    if (vue) next.set('vue', 'toutes');
    if (statut) next.set('statut', 'closes');
    const search = next.toString();
    return search ? `/espace/taches?${search}` : '/espace/taches';
  };

  return (
    <>
      <PageHeader
        title="Tâches"
        description="Le travail concret, lancé, suivi et clôturé à la main par l’équipe."
        actions={
          canLaunch ? (
            <ButtonLink href="/espace/taches/nouvelle">
              Lancer une tâche
            </ButtonLink>
          ) : undefined
        }
      />
      <nav aria-label="Filtres des tâches" className="flex flex-wrap gap-2">
        <FilterLink href={href(false, closed)} current={!everyone}>
          Mes tâches
        </FilterLink>
        <FilterLink href={href(true, closed)} current={everyone}>
          Toute l’équipe
        </FilterLink>
        <span
          aria-hidden
          className="mx-1 border-l border-zinc-300 dark:border-zinc-700"
        />
        <FilterLink href={href(everyone, false)} current={!closed}>
          À traiter
        </FilterLink>
        <FilterLink href={href(everyone, true)} current={closed}>
          Clôturées
        </FilterLink>
      </nav>
      {!tasks.ok ? (
        <Alert tone="error">Tâches indisponibles : {tasks.message}</Alert>
      ) : tasks.data.length === 0 ? (
        <EmptyState
          title={closed ? 'Aucune tâche clôturée' : 'Aucune tâche à traiter'}
        >
          {canLaunch && !closed
            ? 'Lancez une tâche, ponctuelle ou liée à une responsabilité.'
            : undefined}
        </EmptyState>
      ) : (
        <TaskList
          tasks={tasks.data}
          label="Liste des tâches"
          today={todayIn(organization.timezone)}
        />
      )}
    </>
  );
}

export default function TasksPage(props: PageProps<'/espace/taches'>) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Tasks {...props} />
    </Suspense>
  );
}
