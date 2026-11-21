'use client';

import Link, { useLinkStatus } from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import {
  roleHasPermission,
  showsSection,
  type Role,
  type ShopDisplay,
} from '@nagaw/shared';
import { HandCoins, History, ShoppingCart, Users } from 'lucide-react';
import {
  activeHref,
  bottomBarFor,
  navItemsFor,
  type NavItem,
} from './navigation';

/**
 * Vertical links: the dark sidebar (tablet and desktop), or the
 * « Menu » sheet on phones (`only="secondary"`: entries not in the bottom bar).
 */
export function NavLinks({
  role,
  shop,
  only = 'all',
  tone = 'sidebar',
}: {
  role: Role;
  /** What the shop sells and hides (ADR-047, ADR-067). */
  shop: ShopDisplay;
  only?: 'all' | 'secondary';
  tone?: 'sidebar' | 'sheet';
}) {
  const pathname = usePathname();
  const all = navItemsFor(role, shop);
  const current = activeHref(all, pathname);
  const items = all.filter((item) => only === 'all' || !item.bottomBar);
  // The « Menu » sheet on a phone: round tiles, three per row (ADR-063),
  // with « Ils vous doivent » first and the pages of « Paramètres » that
  // people look for (« Historique », « Équipe ») as tiles of their own.
  if (tone === 'sheet') {
    const tiles: NavItem[] = items.flatMap((item) =>
      item.href === '/espace/parametres'
        ? [
            ...(roleHasPermission(role, 'audit.read')
              ? [
                  {
                    ...item,
                    href: '/espace/journal',
                    label: 'Historique',
                    icon: History,
                  },
                ]
              : []),
            ...(roleHasPermission(role, 'members.read') &&
            showsSection(shop, 'team')
              ? [
                  {
                    ...item,
                    href: '/espace/equipe',
                    label: 'Équipe',
                    icon: Users,
                  },
                ]
              : []),
            item,
          ]
        : [item],
    );
    const tileCurrent = activeHref(tiles, pathname);
    return (
      <ul className="grid grid-cols-3 gap-2">
        {roleHasPermission(role, 'customers.read') &&
          showsSection(shop, 'credit') && (
            <li className="col-span-3">
              <Link
                href="/espace/clients?doivent=1"
                className="flex min-h-16 items-center gap-3 rounded-3xl bg-warning-soft px-4 py-3 text-lg font-extrabold text-warning-ink"
              >
                <span className="flex size-12 items-center justify-center rounded-full bg-canvas">
                  <HandCoins aria-hidden className="size-6 shrink-0" />
                </span>
                Ils vous doivent
              </Link>
            </li>
          )}
        {tiles.map(({ href, label, icon: Icon }) => {
          const active = href === tileCurrent;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-26 flex-col items-center justify-center gap-2 rounded-3xl px-1 py-3 text-center text-base leading-tight font-bold ${
                  active
                    ? 'bg-brand-soft text-brand-ink'
                    : 'bg-surface text-ink'
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
  }
  const styles = {
    link: '',
    active: 'bg-brand-soft text-brand-ink',
    idle: 'text-ink hover:bg-surface',
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
              className={`flex min-h-12 items-center gap-3 rounded-full px-4 text-base font-bold transition-colors ${styles.link} ${
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
      className={`flex h-8 w-12 items-center justify-center rounded-full ${
        active || pending ? 'bg-brand-soft text-brand-ink' : ''
      }`}
    >
      {children}
    </span>
  );
}

function BottomTab({ item, active }: { item: NavItem; active: boolean }) {
  const { href, bottomHref, label, shortLabel, icon: Icon } = item;
  return (
    <li className="min-w-0 flex-1">
      <Link
        href={bottomHref ?? href}
        aria-current={active ? 'page' : undefined}
        className={`flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-xl text-sm ${
          active ? 'font-extrabold text-brand-ink' : 'font-bold text-ink-muted'
        }`}
      >
        <TabIcon active={active}>
          <Icon aria-hidden className="size-6" />
        </TabIcon>
        {shortLabel ?? label}
      </Link>
    </li>
  );
}

/**
 * Bottom tab bar entries (phones): « Caisse » raised in the middle, a dark
 * square, between the pages of every day (ADR-063).
 */
export function BottomNavLinks({
  role,
  shop,
}: {
  role: Role;
  shop: ShopDisplay;
}) {
  const pathname = usePathname();
  const { before, after, sell } = bottomBarFor(role, shop);
  const current = activeHref([...before, ...after], pathname);
  return (
    <>
      {before.map((item) => (
        <BottomTab key={item.href} item={item} active={item.href === current} />
      ))}
      {sell && (
        <li className="min-w-0 flex-1">
          <Link
            href="/caisse"
            prefetch={false}
            className="flex min-h-16 flex-col items-center justify-end gap-0.5 rounded-xl text-base font-extrabold text-ink"
          >
            <span className="-mt-7 flex size-15 items-center justify-center rounded-2xl bg-ink text-canvas ring-4 ring-canvas">
              <ShoppingCart aria-hidden className="size-7" />
            </span>
            Caisse
          </Link>
        </li>
      )}
      {after.map((item) => (
        <BottomTab key={item.href} item={item} active={item.href === current} />
      ))}
    </>
  );
}
