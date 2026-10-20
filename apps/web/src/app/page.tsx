import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { fetchApiHealth } from '@/lib/api-health';

async function ApiStatus() {
  await connection();
  const health = await fetchApiHealth(process.env.API_URL);

  if (health.state === 'not_configured') {
    return (
      <p role="status" className="text-amber-700 dark:text-amber-400">
        API non configurée : la variable <code>API_URL</code> est absente.
      </p>
    );
  }
  if (health.state === 'down') {
    return (
      <p role="status" className="text-red-700 dark:text-red-400">
        API indisponible — {health.reason}
      </p>
    );
  }
  return (
    <p role="status" className="text-emerald-700 dark:text-emerald-400">
      API opérationnelle — version {health.data.version}, environnement{' '}
      {health.data.environment}
    </p>
  );
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">
          Nagaw Business
        </h1>
        <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          Des collaborateurs numériques autonomes, auxquels le dirigeant peut
          déléguer des responsabilités.
        </p>
        <p className="text-zinc-600 dark:text-zinc-400">
          La plateforme est en cours de construction. Seuls la création de
          compte et d&apos;organisation sont disponibles.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/inscription"
            className="rounded-md bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800"
          >
            Créer un compte
          </Link>
          <Link
            href="/connexion"
            className="rounded-md border border-zinc-300 px-4 py-2 font-medium dark:border-zinc-700"
          >
            Se connecter
          </Link>
        </div>
      </div>
      <section
        aria-labelledby="status-title"
        className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
      >
        <h2 id="status-title" className="mb-2 font-medium">
          État des services
        </h2>
        <Suspense fallback={<p role="status">Vérification de l&apos;API…</p>}>
          <ApiStatus />
        </Suspense>
      </section>
    </main>
  );
}
