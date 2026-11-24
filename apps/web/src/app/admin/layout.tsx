import type { MeDto } from '@nagaw/shared';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense, type ReactNode } from 'react';
import { ContactAvatar } from '@/components/contacts/contact-actions';
import { SignOutButton } from '@/components/pwa/sign-out-button';
import { BackLink, NavigationTrail } from '@/components/shell/back-link';
import { MoreMenu } from '@/components/shell/mobile-nav';
import { Alert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button-styles';
import { Logo } from '@/components/ui/logo';
import { PageFallback } from '@/components/ui/page-fallback';
import { requirePlatformAdmin } from '@/lib/admin/load';
import { formatContact } from '@/lib/format';
import { AdminNav } from './admin-nav';

export const metadata: Metadata = { title: 'Administration — Nagaw Business' };

/** « Administration », in the brand's soft pill, as a shop's name would be. */
function AdminMark() {
  return (
    <span className="inline-flex min-h-10 min-w-0 items-center gap-2 rounded-full bg-brand-soft px-4 text-base font-extrabold text-brand-ink">
      <ShieldCheck aria-hidden className="size-5 shrink-0" />
      Administration
    </span>
  );
}

/** Who is signed in, the way back to the shops, and leaving. */
function Account({ me }: { me: MeDto }) {
  const who =
    me.displayName ||
    (me.email
      ? formatContact(me.email)
      : me.phone
        ? `+${me.phone}`
        : 'Mon compte');
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-4">
      <div className="flex min-w-0 items-center gap-3">
        <ContactAvatar person={{ id: me.id, name: who }} />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-lg font-extrabold" title={who}>
            {who}
          </span>
          <span className="text-ink-muted">Administrateur</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/espace" className={buttonClasses('secondary', 'flex-1')}>
          <ArrowLeft aria-hidden className="size-5" />
          Mon espace
        </Link>
        <SignOutButton />
      </div>
    </div>
  );
}

/**
 * Frame of the platform administration, apart from the shops' space but
 * drawn like it (ADR-063): white sidebar with round links from tablets up;
 * on phones, a top bar with « Menu » and a bottom bar for every day.
 */
async function AdminFrame({ children }: { children: ReactNode }) {
  const admin = await requirePlatformAdmin();
  if (!admin)
    return (
      <main
        id="contenu"
        className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-10"
      >
        <h1 className="text-2xl font-extrabold">Administration</h1>
        <Alert>
          Cet espace est réservé à l’administration de la plateforme.
        </Alert>
        <Link
          href="/espace"
          className="inline-flex min-h-12 items-center font-semibold text-brand-ink underline underline-offset-4"
        >
          Retour à mon espace
        </Link>
      </main>
    );
  return (
    <div className="flex min-h-full flex-1">
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
        <Logo href="/espace" />
        <AdminMark />
        <nav aria-label="Administration">
          <AdminNav tone="sidebar" />
        </nav>
        <div className="mt-auto">
          <Account me={admin.me} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex min-h-[calc(4rem+env(safe-area-inset-top))] items-center gap-3 bg-canvas px-4 pt-[env(safe-area-inset-top)] md:hidden print:hidden">
          <BackLink className="-ml-2 flex" />
          <div className="flex min-w-0 flex-1">
            <AdminMark />
          </div>
          <MoreMenu>
            <nav aria-label="Administration">
              <AdminNav tone="sheet" />
            </nav>
            <Account me={admin.me} />
          </MoreMenu>
        </header>
        <main
          id="contenu"
          className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 pt-4 pb-[calc(7rem+env(safe-area-inset-bottom))] md:p-8 print:p-0"
        >
          {/* On a phone, « Retour » is in the top bar. */}
          <BackLink className="-ml-2 hidden self-start md:flex" />
          {children}
        </main>
      </div>
      <nav
        aria-label="Administration, accès rapide"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
      >
        <AdminNav tone="bottom" />
      </nav>
    </div>
  );
}

export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-5xl p-4 md:p-8">
          <PageFallback label="Chargement de l’administration…" />
        </main>
      }
    >
      <AdminFrame>{children}</AdminFrame>
    </Suspense>
  );
}
