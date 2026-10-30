'use client';

import { ChevronLeft, Store } from 'lucide-react';
import Link, { useLinkStatus } from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { Role, ShopOffer } from '@nagaw/shared';
import { activeHref, navItemsFor, parentPath } from './navigation';

/** Start of the phone header: « Retour » on a sub-page, the shop otherwise. */
export function HeaderStart() {
  const parent = parentPath(usePathname());
  if (parent)
    return (
      <Link
        href={parent}
        className="-ml-2 flex min-h-12 shrink-0 items-center gap-0.5 rounded-xl pr-2 text-base font-bold text-brand-ink"
      >
        <ChevronLeft aria-hidden className="size-7" />
        Retour
      </Link>
    );
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-strong text-white">
      <Store aria-hidden className="size-6" />
    </span>
  );
}

/**
 * Vertical links: the dark sidebar (tablet and desktop), or the
 * « Plus » sheet on phones (`only="secondary"`: entries not in the bottom bar).
 */
export function NavLinks({
  role,
  offer,
  only = 'all',
  tone = 'sidebar',
}: {
  role: Role;
  offer: ShopOffer;
  only?: 'all' | 'secondary';
  tone?: 'sidebar' | 'sheet';
}) {
  const pathname = usePathname();
  const all = navItemsFor(role, offer);
  const current = activeHref(all, pathname);
  const items = all.filter((item) => only === 'all' || !item.bottomBar);
  const styles =
    tone === 'sidebar'
      ? {
          link: 'focus-visible:outline-white',
          active: 'bg-brand-strong text-white shadow-sm',
          idle: 'text-white hover:bg-white/10',
        }
      : {
          link: '',
          active: 'bg-brand-strong text-white shadow-sm',
          idle: 'text-ink hover:bg-surface-muted',
        };
  return (
    <ul className="flex flex-col gap-1">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === current;
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-base font-bold transition-colors ${styles.link} ${
                active ? styles.active : styles.idle
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

/** The tab's icon: it lights up at the touch, before the page has loaded. */
function TabIcon({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  const { pending } = useLinkStatus();
  return (
    <span
      className={`flex h-8 w-14 items-center justify-center rounded-full ${
        active || pending ? 'bg-brand-strong text-white shadow-sm' : ''
      }`}
    >
      {children}
    </span>
  );
}

/** Bottom tab bar entries (phones). */
export function BottomNavLinks({
  role,
  offer,
}: {
  role: Role;
  offer: ShopOffer;
}) {
  const pathname = usePathname();
  const all = navItemsFor(role, offer);
  const current = activeHref(all, pathname);
  return (
    <>
      {all
        .filter((item) => item.bottomBar)
        .map(({ href, label, shortLabel, icon: Icon }) => {
          const active = href === current;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-xl text-base font-bold ${
                  active ? 'text-brand-ink' : 'text-ink-muted'
                }`}
              >
                <TabIcon active={active}>
                  <Icon aria-hidden className="size-6" />
                </TabIcon>
                {shortLabel ?? label}
              </Link>
            </li>
          );
        })}
    </>
  );
}
