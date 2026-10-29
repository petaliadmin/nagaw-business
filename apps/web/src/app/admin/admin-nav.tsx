'use client';

import {
  Inbox,
  LayoutDashboard,
  MessageSquare,
  RefreshCw,
  Store,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/admin', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/admin/finances', label: 'Finances', icon: Wallet },
  { href: '/admin/boutiques', label: 'Boutiques', icon: Store },
  { href: '/admin/demandes', label: 'Demandes d’offre', icon: Inbox },
  { href: '/admin/synchronisation', label: 'Synchronisation', icon: RefreshCw },
  { href: '/admin/avis', label: 'Avis', icon: MessageSquare },
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
 * The administration's pages: a column in the dark sidebar from tablets
 * up, wrapping buttons under the header on phones (no sideways scroll).
 */
export function AdminNav({ tone }: { tone: 'sidebar' | 'bar' }) {
  const active = current(usePathname());
  const styles =
    tone === 'sidebar'
      ? {
          list: 'flex flex-col gap-1',
          link: 'focus-visible:outline-white',
          on: 'bg-brand-strong text-white shadow-sm',
          off: 'text-white hover:bg-white/10',
        }
      : {
          list: 'flex flex-wrap gap-1',
          link: '',
          on: 'bg-brand-strong text-white shadow-sm',
          off: 'text-ink hover:bg-surface-muted',
        };
  return (
    <ul className={styles.list}>
      {LINKS.map(({ href, label, icon: Icon }) => {
        const on = href === active;
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={on ? 'page' : undefined}
              className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-base font-bold ${styles.link} ${
                on ? styles.on : styles.off
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
