import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense, type ReactNode } from 'react';
import { SignOutButton } from '@/components/pwa/sign-out-button';
import { Alert } from '@/components/ui/alert';
import { Logo } from '@/components/ui/logo';
import { PageFallback } from '@/components/ui/page-fallback';
import { requirePlatformAdmin } from '@/lib/admin/load';

export const metadata: Metadata = { title: 'Administration — Nagaw Business' };

const LINKS = [
  { href: '/admin', label: 'Tableau de bord' },
  { href: '/admin/boutiques', label: 'Boutiques' },
  { href: '/admin/demandes', label: 'Demandes d’offre' },
  { href: '/admin/synchronisation', label: 'Synchronisation' },
] as const;

/** Frame of the platform administration, apart from the shops' space. */
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
    <div className="flex min-h-dvh flex-col">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-surface focus:p-3"
      >
        Aller au contenu
      </a>
      <header className="flex flex-col gap-3 border-b border-line bg-surface px-4 py-3 md:flex-row md:items-center md:justify-between md:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <Logo href="/espace" />
          <span className="rounded-full bg-accounting-soft px-3 py-0.5 font-bold text-accounting-ink">
            Administration
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="truncate text-ink-muted">{admin.me.email}</span>
          <SignOutButton />
        </div>
      </header>
      <nav
        aria-label="Administration"
        className="border-b border-line bg-surface px-4 md:px-8"
      >
        <ul className="flex flex-wrap gap-1">
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="inline-flex min-h-12 items-center rounded-xl px-3 font-bold text-ink hover:bg-surface-muted"
              >
                {link.label}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/espace"
              className="inline-flex min-h-12 items-center rounded-xl px-3 font-semibold text-brand-ink underline underline-offset-4"
            >
              Mon espace
            </Link>
          </li>
        </ul>
      </nav>
      <main
        id="contenu"
        className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 md:p-8"
      >
        {children}
      </main>
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
