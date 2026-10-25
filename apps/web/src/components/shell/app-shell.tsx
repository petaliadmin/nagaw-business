import type { MeDto, OrganizationWithRoleDto } from '@nagaw/shared';
import { Plus, Store } from 'lucide-react';
import Link from 'next/link';
import { connection } from 'next/server';
import type { ReactNode } from 'react';
import { CreateOrganizationForm } from '@/app/espace/create-organization-form';
import { SignOutButton } from '@/components/pwa/sign-out-button';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Logo } from '@/components/ui/logo';
import { ROLE_LABELS } from '@/lib/labels';
import { loadWorkspace } from '@/lib/workspace/load';
import { MoreMenu } from './mobile-nav';
import { BottomNavLinks, NavLinks } from './nav-links';
import { OrganizationSwitcher } from './organization-switcher';

type Tone = 'surface' | 'sidebar';

function NewShopLink({ tone }: { tone: Tone }) {
  return (
    <Link
      href="/espace/nouvelle-boutique"
      className={`flex min-h-12 items-center gap-2 rounded-xl px-3 text-base font-bold underline-offset-4 hover:underline ${
        tone === 'sidebar'
          ? 'text-white focus-visible:outline-white'
          : 'text-brand-ink'
      }`}
    >
      <Plus aria-hidden className="size-5" />
      Créer une autre boutique
    </Link>
  );
}

function Account({
  me,
  organization,
  tone,
}: {
  me: MeDto;
  organization: OrganizationWithRoleDto;
  tone: Tone;
}) {
  return (
    <div
      className={`flex flex-col gap-3 border-t pt-4 ${
        tone === 'sidebar' ? 'border-white/30' : 'border-line'
      }`}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <span className="truncate text-base font-semibold" title={me.email}>
          {me.email}
        </span>
        <span>
          <Badge tone={tone === 'sidebar' ? 'neutral' : 'brand'}>
            {ROLE_LABELS[organization.role]}
          </Badge>
        </span>
      </div>
      {me.platformAdmin && (
        <Link
          href="/admin"
          className={`inline-flex min-h-12 items-center font-semibold underline underline-offset-4 ${
            tone === 'sidebar'
              ? 'text-white focus-visible:outline-white'
              : 'text-brand-ink'
          }`}
        >
          Administration de la plateforme
        </Link>
      )}
      <SignOutButton tone={tone} />
    </div>
  );
}

function CenteredState({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-4 py-10">
      {children}
    </main>
  );
}

/**
 * Authenticated application frame. Resolves the session and the active
 * shop once per request (shared with the page through `loadWorkspace`),
 * then renders navigation around the page: a brand-colored sidebar from
 * tablets up, a bottom tab bar with « Plus » on phones (DESIGN.md).
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
        <h1 className="text-2xl font-extrabold">Espace indisponible</h1>
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
        <Logo href="/espace" />
        <h1 className="text-3xl font-extrabold">Créez votre boutique</h1>
        <p className="text-ink-muted">
          Connecté en tant que <strong>{workspace.me.email}</strong>. Votre
          boutique regroupe votre équipe et, bientôt, vos produits et vos
          ventes.
        </p>
        <Card>
          <CreateOrganizationForm />
        </Card>
        <div>
          <SignOutButton />
        </div>
      </CenteredState>
    );
  }

  const { me, organization } = workspace;
  return (
    <div className="flex min-h-full flex-1">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-xl focus:bg-surface focus:px-4 focus:py-3 focus:font-bold focus:shadow"
      >
        Aller au contenu
      </a>
      <aside
        aria-label="Barre latérale"
        className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col gap-6 overflow-y-auto bg-brand-strong p-4 text-white md:flex print:hidden"
      >
        <Logo href="/espace" tone="sidebar" />
        <div className="flex flex-col gap-1">
          <OrganizationSwitcher
            organizations={me.organizations}
            activeId={organization.id}
            tone="sidebar"
          />
          <NewShopLink tone="sidebar" />
        </div>
        <nav aria-label="Navigation principale">
          <NavLinks role={organization.role} />
        </nav>
        <div className="mt-auto">
          <Account me={me} organization={organization} tone="sidebar" />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b border-line bg-surface px-4 md:hidden print:hidden">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-strong text-white">
            <Store aria-hidden className="size-6" />
          </span>
          <span className="min-w-0 truncate text-lg font-extrabold">
            {organization.name}
          </span>
        </header>
        <main
          id="contenu"
          className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 pt-4 pb-28 md:p-8 print:p-0"
        >
          {children}
        </main>
      </div>
      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgb(0_0_0/0.06)] md:hidden print:hidden"
      >
        <ul className="mx-auto flex max-w-xl gap-1 px-2 py-1">
          <BottomNavLinks role={organization.role} />
          <MoreMenu>
            <nav aria-label="Autres pages">
              <NavLinks
                role={organization.role}
                only="secondary"
                tone="sheet"
              />
            </nav>
            <div className="flex flex-col gap-1">
              <OrganizationSwitcher
                organizations={me.organizations}
                activeId={organization.id}
              />
              <NewShopLink tone="surface" />
            </div>
            <Account me={me} organization={organization} tone="surface" />
          </MoreMenu>
        </ul>
      </nav>
    </div>
  );
}
