'use client';

import {
  Crown,
  FileText,
  Inbox,
  LayoutDashboard,
  MessageSquare,
  RefreshCw,
  Store,
  Users,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  {
    href: '/admin',
    label: 'Tableau de bord',
    shortLabel: 'Accueil',
    icon: LayoutDashboard,
  },
  // What is acted on every day first, then the follow-up.
  { href: '/admin/boutiques', label: 'Boutiques', icon: Store },
  { href: '/admin/comptes', label: 'Comptes', icon: Users },
  { href: '/admin/factures', label: 'Factures', icon: FileText },
  { href: '/admin/demandes', label: 'Demandes d’offre', icon: Inbox },
  { href: '/admin/offres', label: 'Offres', icon: Crown },
  { href: '/admin/finances', label: 'Finances', icon: Wallet },
  { href: '/admin/synchronisation', label: 'Synchronisation', icon: RefreshCw },
  { href: '/admin/avis', label: 'Avis', icon: MessageSquare },
] as const;

/** The phone's bottom bar: the pages of every day (ADR-063). */
const BAR = [
  '/admin',
  '/admin/boutiques',
  '/admin/factures',
  '/admin/comptes',
] as const;

/** The deepest link the page is under: `/admin` only for itself. */
function current(pathname: string) {
  return (
    LINKS.filter(
      (l) =>
        pathname === l.href ||
        (l.href !== '/admin' && pathname.startsWith(`${l.href}/`)),
    ).at(-1)?.href ?? null
  );
}

/**
 * The administration's pages, drawn like the shops' navigation (ADR-063):
 * a column of round links in the white sidebar from tablets up; on phones,
 * the bottom bar for every day and round tiles in the « Menu » sheet.
 */
export function AdminNav({ tone }: { tone: 'sidebar' | 'sheet' | 'bottom' }) {
  const active = current(usePathname());

  if (tone === 'bottom')
    return (
      <ul className="mx-auto flex max-w-lg items-stretch px-2">
        {LINKS.filter((l) => (BAR as readonly string[]).includes(l.href)).map(
          (link) => {
            const { href, label, icon: Icon } = link;
            const on = href === active;
            return (
              <li key={href} className="min-w-0 flex-1">
                <Link
                  href={href}
                  aria-current={on ? 'page' : undefined}
                  className={`flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-xl text-sm ${
                    on
                      ? 'font-extrabold text-brand-ink'
                      : 'font-bold text-ink-muted'
                  }`}
                >
                  <span
                    className={`flex h-8 w-12 items-center justify-center rounded-full ${
                      on ? 'bg-brand-soft text-brand-ink' : ''
                    }`}
                  >
                    <Icon aria-hidden className="size-6" />
                  </span>
                  {'shortLabel' in link ? link.shortLabel : label}
                </Link>
              </li>
            );
          },
        )}
      </ul>
    );

  if (tone === 'sheet')
    return (
      <ul className="grid grid-cols-3 gap-2">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const on = href === active;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={on ? 'page' : undefined}
                className={`flex min-h-26 flex-col items-center justify-center gap-2 rounded-3xl px-1 py-3 text-center text-base leading-tight font-bold ${
                  on ? 'bg-brand-soft text-brand-ink' : 'bg-surface text-ink'
                }`}
              >
                <span className="flex size-12 items-center justify-center rounded-full bg-canvas">
                  <Icon aria-hidden className="size-6 shrink-0" />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    );

  return (
    <ul className="flex flex-col gap-1">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const on = href === active;
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={on ? 'page' : undefined}
              className={`flex min-h-12 items-center gap-3 rounded-full px-4 text-base font-bold transition-colors ${
                on
                  ? 'bg-brand-soft text-brand-ink'
                  : 'text-ink hover:bg-surface'
              }`}
            >
              <Icon aria-hidden className="size-6 shrink-0" />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
