'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS, isActive } from './navigation';

/**
 * Vertical links: the brand-colored sidebar (tablet and desktop), or the
 * « Plus » sheet on phones (`only="secondary"`: entries not in the bottom bar).
 */
export function NavLinks({
  only = 'all',
  tone = 'sidebar',
}: {
  only?: 'all' | 'secondary';
  tone?: 'sidebar' | 'sheet';
}) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => only === 'all' || !item.bottomBar);
  const styles =
    tone === 'sidebar'
      ? {
          link: 'focus-visible:outline-white',
          active: 'bg-white text-brand-strong shadow-sm',
          idle: 'text-white hover:bg-white/15',
        }
      : {
          link: '',
          active: 'bg-brand-soft text-brand-ink',
          idle: 'text-ink hover:bg-surface-muted',
        };
  return (
    <ul className="flex flex-col gap-1">
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActive(href, pathname);
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

/** Bottom tab bar entries (phones). */
export function BottomNavLinks() {
  const pathname = usePathname();
  return (
    <>
      {NAV_ITEMS.filter((item) => item.bottomBar).map(
        ({ href, label, icon: Icon }) => {
          const active = isActive(href, pathname);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-xl text-base font-bold ${
                  active ? 'text-brand-ink' : 'text-ink-muted'
                }`}
              >
                <span
                  className={`flex h-8 w-14 items-center justify-center rounded-full ${
                    active ? 'bg-brand-soft' : ''
                  }`}
                >
                  <Icon aria-hidden className="size-6" />
                </span>
                {label}
              </Link>
            </li>
          );
        },
      )}
    </>
  );
}
