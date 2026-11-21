import {
  roleHasPermission,
  type MeDto,
  type OrganizationWithRoleDto,
} from '@nagaw/shared';
import { ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { connection } from 'next/server';
import type { ReactNode } from 'react';
import { closeShopAccess } from '@/app/admin/actions';
import { CreateOrganizationForm } from '@/app/espace/create-organization-form';
import { InstallButton, InstallDialog } from '@/components/pwa/install-app';
import { formatContact } from '@/lib/format';
import { ContactAvatar } from '@/components/contacts/contact-actions';
import { SignOutButton } from '@/components/pwa/sign-out-button';
import { SubmitButton } from '@/components/submit-button';
import { Alert } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { Logo } from '@/components/ui/logo';
import { buttonClasses } from '@/components/ui/button-styles';
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
  const who =
    me.displayName ||
    (me.email
      ? formatContact(me.email)
      : me.phone
        ? `+${me.phone}`
        : 'Mon compte');
  return (
    <div
      className={`flex flex-col gap-3 border-t pt-4 ${
        tone === 'sidebar' ? 'border-white/30' : 'border-line'
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <ContactAvatar person={{ id: me.id, name: who }} />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-lg font-extrabold" title={who}>
            {who}
          </span>
          <span className="text-ink-muted">
            {ROLE_LABELS[organization.role]}
          </span>
        </div>
      </div>
      <InstallButton tone={tone} />
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
      <div className="flex flex-wrap gap-2">
        <FeedbackLink tone={tone} pill={tone === 'surface'} />
        <SignOutButton tone={tone} />
      </div>
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
 * then renders navigation around the page: a white sidebar with
 * « Caisse » on top from tablets up; on phones, a white bottom tab bar with
 * « Caisse » in the middle and « Menu » in the top bar (ADR-063, DESIGN.md).
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
        <p className="font-bold text-ink-muted">
          Étape 2 sur 2 · c’est presque fini
        </p>
        <h1 className="text-3xl font-extrabold">Créez votre boutique</h1>
        <Card>
          <CreateOrganizationForm
            ownerName={workspace.me.displayName}
            phone={workspace.me.phone}
          />
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
        className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col gap-5 overflow-y-auto border-r border-line bg-canvas p-4 text-ink md:flex print:hidden"
      >
        <div className="flex items-center justify-between gap-2">
          <Logo href="/espace" />
          <NotificationBell
            accessToken={accessToken}
            organizationId={organization.id}
            tone="surface"
          />
        </div>
        {roleHasPermission(organization.role, 'sales.create') && (
          <Link
            href="/caisse"
            prefetch={false}
            className={buttonClasses('primary', 'min-h-14 text-lg')}
          >
            <ShoppingCart aria-hidden className="size-6" />
            Caisse
          </Link>
        )}
        <ShopSwitcher
          organization={organization}
          organizations={me.organizations}
          tone="surface"
        />
        <nav aria-label="Navigation principale">
          <NavLinks role={organization.role} shop={organization} />
        </nav>
        <div className="mt-auto">
          <Account me={me} organization={organization} tone="surface" />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="group/top sticky top-0 z-30 flex min-h-[calc(4rem+env(safe-area-inset-top))] items-center gap-3 bg-canvas px-4 pt-[env(safe-area-inset-top)] md:hidden print:hidden">
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
          <MoreMenu>
            <nav aria-label="Autres pages">
              <NavLinks
                role={organization.role}
                shop={organization}
                only="secondary"
                tone="sheet"
              />
            </nav>
            <Account me={me} organization={organization} tone="surface" />
          </MoreMenu>
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
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
      >
        <ul className="mx-auto flex max-w-xl px-1 py-1">
          <BottomNavLinks role={organization.role} shop={organization} />
        </ul>
      </nav>
    </div>
  );
}
