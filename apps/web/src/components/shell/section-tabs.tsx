'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { SectionTab } from './navigation';

/**
 * Links between the pages of one menu section (« Factures », « Devis »…).
 * Shown on the section's list pages only, not on a detail page.
 */
export function SectionTabs({
  label,
  tabs,
}: {
  label: string;
  tabs: SectionTab[];
}) {
  const pathname = usePathname();
  const current = tabs.find(
    (tab) => tab.href === pathname || tab.paths?.includes(pathname),
  );
  if (!current || tabs.length < 2) return null;
  return (
    <nav aria-label={label} className="print:hidden">
      <ul className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const active = tab === current;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex min-h-12 items-center rounded-full border-2 px-4 text-base font-bold ${
                  active
                    ? 'border-brand-strong bg-brand-strong text-white'
                    : 'border-line-strong bg-surface text-ink hover:bg-surface-muted'
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
