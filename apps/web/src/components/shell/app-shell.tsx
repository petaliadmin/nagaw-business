import type { MeDto, OrganizationWithRoleDto } from '@nagaw/shared';
import Link from 'next/link';
import { connection } from 'next/server';
import type { ReactNode } from 'react';
import { signOut } from '@/app/(auth)/actions';
import { CreateOrganizationForm } from '@/app/espace/create-organization-form';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ROLE_LABELS } from '@/lib/labels';
import { loadWorkspace } from '@/lib/workspace/load';
import { MobileNav } from './mobile-nav';
import { NavLinks } from './nav-links';
import { OrganizationSwitcher } from './organization-switcher';

function SignOutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
      >
        Se déconnecter
      </button>
    </form>
  );
}

function SidebarContent({
  me,
  organization,
}: {
  me: MeDto;
  organization: OrganizationWithRoleDto;
}) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <OrganizationSwitcher
          organizations={me.organizations}
          activeId={organization.id}
        />
        <Link
          href="/espace/nouvelle-organisation"
          className="text-sm text-emerald-800 underline dark:text-emerald-300"
        >
          Créer une autre organisation
        </Link>
      </div>
      <nav aria-label="Navigation principale">
        <NavLinks />
      </nav>
      <div className="mt-auto flex flex-col gap-2 border-t border-zinc-200 pt-4 text-sm dark:border-zinc-800">
        <span className="truncate" title={me.email}>
          {me.email}
        </span>
        <span>
          <Badge>{ROLE_LABELS[organization.role]}</Badge>
        </span>
        <SignOutButton />
      </div>
    </>
  );
}

function CenteredState({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-4 py-12">
      {children}
    </main>
  );
}

/**
 * Authenticated application frame. Resolves the session and the active
 * organization once per request (shared with the page through
 * `loadWorkspace`), then renders navigation around the page.
 */
export async function AppShell({ children }: { children: ReactNode }) {
  await connection();
  const workspace = await loadWorkspace();

  if (workspace.status === 'not-configured') {
    return (
      <CenteredState>
        <Alert tone="error">
          L’authentification n’est pas encore configurée sur cet environnement.
        </Alert>
      </CenteredState>
    );
  }

  if (workspace.status === 'error') {
    return (
      <CenteredState>
        <h1 className="text-2xl font-semibold">Espace indisponible</h1>
        <Alert tone="error">
          Impossible de charger votre espace : {workspace.message}
        </Alert>
        <div>
          <SignOutButton />
        </div>
      </CenteredState>
    );
  }

  if (workspace.status === 'no-organization') {
    return (
      <CenteredState>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="text-lg font-semibold">Nagaw Business</span>
          <SignOutButton />
        </div>
        <h1 className="text-2xl font-semibold">Créez votre organisation</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Connecté en tant que <strong>{workspace.me.email}</strong>. Votre
          organisation regroupe votre équipe et les responsabilités que vous lui
          confiez.
        </p>
        <Card>
          <CreateOrganizationForm />
        </Card>
      </CenteredState>
    );
  }

  const { me, organization } = workspace;
  return (
    <div className="flex min-h-full flex-1">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:shadow"
      >
        Aller au contenu
      </a>
      <aside
        aria-label="Barre latérale"
        className="hidden w-64 shrink-0 flex-col gap-6 border-r border-zinc-200 bg-zinc-50 p-4 md:flex dark:border-zinc-800 dark:bg-zinc-950"
      >
        <Link href="/espace" className="text-lg font-semibold tracking-tight">
          Nagaw Business
        </Link>
        <SidebarContent me={me} organization={organization} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-zinc-200 bg-white px-4 md:hidden dark:border-zinc-800 dark:bg-zinc-950">
          <span className="min-w-0 truncate font-semibold">
            {organization.name}
          </span>
          <MobileNav>
            <SidebarContent me={me} organization={organization} />
          </MobileNav>
        </header>
        <main
          id="contenu"
          className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-4 md:p-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
