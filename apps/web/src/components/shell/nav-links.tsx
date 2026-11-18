'use client';

import Link, { useLinkStatus } from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { Role, ShopOffer } from '@nagaw/shared';
import { ShoppingCart } from 'lucide-react';
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
        className={`flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-xl text-base ${
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
 * Bottom tab bar entries (phones): « Vendre » raised in the middle, the
 * only green of the bar, between the pages of every day (ADR-062).
 */
export function BottomNavLinks({
  role,
  offer,
}: {
  role: Role;
  offer: ShopOffer;
}) {
  const pathname = usePathname();
  const { before, after, sell } = bottomBarFor(role, offer);
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
            className="flex min-h-16 flex-col items-center justify-end gap-0.5 rounded-xl text-base font-extrabold text-sales-ink"
          >
            <span className="-mt-7 flex size-14 items-center justify-center rounded-full bg-sales-strong text-white shadow-md ring-4 ring-surface">
              <ShoppingCart aria-hidden className="size-7" />
            </span>
            Vendre
          </Link>
        </li>
      )}
      {after.map((item) => (
        <BottomTab key={item.href} item={item} active={item.href === current} />
      ))}
    </>
  );
}
