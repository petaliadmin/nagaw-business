import type { MeDto } from '@nagaw/shared';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { apiAsUser, getSession } from '@/lib/api/server';
import { signOut } from '../(auth)/actions';
import { CreateOrganizationForm } from './create-organization-form';

export const metadata: Metadata = { title: 'Mon espace — Nagaw Business' };

const ROLE_LABELS: Record<string, string> = {
  owner: 'Propriétaire',
  admin: 'Administrateur',
  member: 'Membre',
  viewer: 'Lecteur',
};

async function Workspace() {
  // Always per request, even when Supabase is not configured at build time.
  await connection();
  const session = await getSession();
  if (session.status === 'not-configured') {
    return (
      <p role="alert">
        L’authentification n’est pas encore configurée sur cet environnement.
      </p>
    );
  }
  if (session.status === 'signed-out') redirect('/connexion');

  const me = await apiAsUser<MeDto>(session.accessToken, { path: '/me' });
  if (!me.ok) {
    return (
      <p role="alert" className="text-red-700 dark:text-red-400">
        Impossible de charger votre espace : {me.message}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-zinc-600 dark:text-zinc-400">
          Connecté en tant que{' '}
          <strong className="text-zinc-900 dark:text-zinc-100">
            {me.data.email}
          </strong>
        </p>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
          >
            Se déconnecter
          </button>
        </form>
      </div>

      {me.data.organizations.length === 0 ? (
        <section aria-labelledby="first-org" className="flex flex-col gap-4">
          <h2 id="first-org" className="text-xl font-semibold">
            Créez votre organisation
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400">
            Votre organisation regroupe votre équipe, vos données et, plus tard,
            vos collaborateurs numériques.
          </p>
          <CreateOrganizationForm />
        </section>
      ) : (
        <section aria-labelledby="orgs" className="flex flex-col gap-4">
          <h2 id="orgs" className="text-xl font-semibold">
            Vos organisations
          </h2>
          <ul className="flex flex-col gap-2">
            {me.data.organizations.map((org) => (
              <li
                key={org.id}
                className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-800"
              >
                <span className="font-medium">{org.name}</span>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  {ROLE_LABELS[org.role] ?? org.role}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            La gestion de l’équipe et les modules métier arriveront dans les
            prochaines phases.
          </p>
        </section>
      )}
    </div>
  );
}

export default function WorkspacePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">Mon espace</h1>
      <Suspense fallback={<p role="status">Chargement de votre espace…</p>}>
        <Workspace />
      </Suspense>
    </main>
  );
}
