import { ArrowLeft, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense, type ReactNode } from 'react';
import { SignOutButton } from '@/components/pwa/sign-out-button';
import { Alert } from '@/components/ui/alert';
import { Logo } from '@/components/ui/logo';
import { PageFallback } from '@/components/ui/page-fallback';
import { requirePlatformAdmin } from '@/lib/admin/load';
import { AdminNav } from './admin-nav';

export const metadata: Metadata = { title: 'Administration — Nagaw Business' };

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
    <div className="flex min-h-dvh flex-1">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-surface focus:p-3"
      >
        Aller au contenu
      </a>
      <aside
        aria-label="Barre latérale"
        className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col gap-6 overflow-y-auto bg-sidebar p-4 text-white md:flex print:hidden"
      >
        <Logo href="/espace" tone="sidebar" />
        <p className="flex min-h-12 items-center gap-2 rounded-xl bg-white px-3 py-2 text-lg font-extrabold text-brand-strong shadow-sm">
          <ShieldCheck aria-hidden className="size-5 shrink-0" />
          Administration
        </p>
        <nav aria-label="Administration">
          <AdminNav tone="sidebar" />
        </nav>
        <div className="mt-auto flex flex-col gap-3 border-t border-white/30 pt-4">
          <span
            className="truncate text-base font-semibold"
            title={admin.me.email}
          >
            {admin.me.email}
          </span>
          <Link
            href="/espace"
            className="inline-flex min-h-12 items-center gap-2 font-semibold text-white underline underline-offset-4 focus-visible:outline-white"
          >
            <ArrowLeft aria-hidden className="size-5" />
            Mon espace
          </Link>
          <SignOutButton tone="sidebar" />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-col gap-3 border-b border-line bg-surface px-4 py-3 md:hidden print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Logo href="/espace" />
              <span className="rounded-full bg-brand-soft px-3 py-0.5 font-bold text-brand-ink">
                Administration
              </span>
            </div>
            <Link
              href="/espace"
              className="inline-flex min-h-12 items-center font-semibold text-brand-ink underline underline-offset-4"
            >
              Mon espace
            </Link>
          </div>
          <nav aria-label="Administration">
            <AdminNav tone="bar" />
          </nav>
        </header>
        <main
          id="contenu"
          className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 md:p-8"
        >
          {children}
        </main>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface px-4 py-3 md:hidden print:hidden">
          <span className="min-w-0 truncate text-ink-muted">
            {admin.me.email}
          </span>
          <SignOutButton />
        </div>
      </div>
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
