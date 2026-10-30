import type { MeDto, OrganizationWithRoleDto } from '@nagaw/shared';
import Link from 'next/link';
import { connection } from 'next/server';
import type { ReactNode } from 'react';
import { closeShopAccess } from '@/app/admin/actions';
import { CreateOrganizationForm } from '@/app/espace/create-organization-form';
import { InstallButton, InstallDialog } from '@/components/pwa/install-app';
import { SignOutButton } from '@/components/pwa/sign-out-button';
import { SubmitButton } from '@/components/submit-button';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Logo } from '@/components/ui/logo';
import { ROLE_LABELS } from '@/lib/labels';
import { loadWorkspace } from '@/lib/workspace/load';
import { FeedbackLink } from './feedback-link';
import { MoreMenu } from './mobile-nav';
import { NotificationBell } from './notification-bell';
import { ShopSwitcher } from './shop-switcher';
import { BackLink, NavigationTrail } from './back-link';
import { BottomNavLinks, NavLinks } from './nav-links';

type Tone = 'surface' | 'sidebar';

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
      <InstallButton tone={tone} />
      <FeedbackLink tone={tone} />
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

/** Always in view while the platform is inside a shop (ADR-040). */
function PlatformAccessBanner({
  shopId,
  shopName,
}: {
  shopId: string;
  shopName: string;
}) {
  return (
    <div className="print:hidden">
      <Alert tone="warning">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>
            Vous êtes dans « {shopName} » en tant que{' '}
            <strong>Nagaw (plateforme)</strong> : tout ce que vous faites est
            inscrit dans son historique.
          </span>
          <form action={closeShopAccess}>
            <input type="hidden" name="shopId" value={shopId} />
            <SubmitButton variant="secondary" pendingLabel="Sortie…">
              Quitter la boutique
            </SubmitButton>
          </form>
        </div>
      </Alert>
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
 * then renders navigation around the page: a dark sidebar from
 * tablets up; on phones, a white bottom tab bar with « Plus », the
 * current page marked like in the sidebar (DESIGN.md).
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
          <CreateOrganizationForm ownerName={workspace.me.displayName} />
        </Card>
        <div>
          <SignOutButton />
        </div>
      </CenteredState>
    );
  }

  const { me, organization, accessToken } = workspace;
  return (
    <div className="flex min-h-full flex-1">
      <InstallDialog />
      <NavigationTrail />
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-xl focus:bg-surface focus:px-4 focus:py-3 focus:font-bold focus:shadow"
      >
        Aller au contenu
      </a>
      <aside
        aria-label="Barre latérale"
        className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col gap-6 overflow-y-auto bg-sidebar p-4 text-white md:flex print:hidden"
      >
        <div className="flex items-center justify-between gap-2">
          <Logo href="/espace" tone="sidebar" />
          <NotificationBell
            accessToken={accessToken}
            organizationId={organization.id}
            tone="sidebar"
          />
        </div>
        <ShopSwitcher
          organization={organization}
          organizations={me.organizations}
          tone="sidebar"
        />
        <nav aria-label="Navigation principale">
          <NavLinks role={organization.role} offer={organization.offer} />
        </nav>
        <div className="mt-auto">
          <Account me={me} organization={organization} tone="sidebar" />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex min-h-[calc(4rem+env(safe-area-inset-top))] items-center gap-3 border-b border-line bg-surface px-4 pt-[env(safe-area-inset-top)] md:hidden print:hidden">
          <BackLink className="-ml-2 flex" />
          <ShopSwitcher
            organization={organization}
            organizations={me.organizations}
            tone="surface"
          />
          <NotificationBell
            accessToken={accessToken}
            organizationId={organization.id}
            tone="surface"
          />
        </header>
        <main
          id="contenu"
          className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 pt-4 pb-[calc(7rem+env(safe-area-inset-bottom))] md:p-8 print:p-0"
        >
          {/* On a phone, « Retour » is in the top bar. */}
          <BackLink className="-ml-2 hidden self-start md:flex" />
          {organization.platformAccess && (
            <PlatformAccessBanner
              shopId={organization.id}
              shopName={organization.name}
            />
          )}
          {children}
        </main>
      </div>
      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgb(0_0_0/0.06)] md:hidden print:hidden"
      >
        <ul className="mx-auto flex max-w-xl gap-1 px-2 py-1">
          <BottomNavLinks role={organization.role} offer={organization.offer} />
          <MoreMenu>
            <nav aria-label="Autres pages">
              <NavLinks
                role={organization.role}
                offer={organization.offer}
                only="secondary"
                tone="sheet"
              />
            </nav>
            <Account me={me} organization={organization} tone="surface" />
          </MoreMenu>
        </ul>
      </nav>
    </div>
  );
}
