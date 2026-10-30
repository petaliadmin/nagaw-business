import {
  roleHasPermission,
  sellsGoods,
  type Permission,
  type Role,
  type ShopOffer,
} from '@nagaw/shared';
import {
  Banknote,
  ChartColumn,
  Contact,
  House,
  Package,
  Receipt,
  Settings,
  Truck,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { CATALOG_TITLES } from '@/lib/catalog/offer';

export interface NavItem {
  href: string;
  label: string;
  /** Label in the phone bottom bar, where 16 px must fit on 360 px. */
  shortLabel?: string;
  icon: LucideIcon;
  /** Shown in the phone bottom bar; the others live under « Plus ». */
  bottomBar: boolean;
  /** Other sections shown as tabs of this entry (see SECTION_TABS). */
  matches?: readonly string[];
  /** Hidden from the roles without it (the API refuses them anyway). */
  permission?: Permission;
}

/**
 * Menu in the owner's order (2026-10-25). Every entry points to a page that
 * exists: « Commandes » and « Achats » join it when their module ships (no
 * dead links). Invoices, accounting, team, history and subscription are
 * tabs of their section. The phone bottom bar holds at most three entries
 * next to « Plus » (DESIGN.md).
 */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    href: '/espace',
    label: 'Tableau de bord',
    shortLabel: 'Accueil',
    icon: House,
    bottomBar: true,
  },
  {
    href: '/espace/ventes',
    label: 'Ventes',
    icon: Receipt,
    bottomBar: true,
    matches: ['/espace/factures'],
  },
  {
    href: '/espace/produits',
    label: 'Produits et services',
    shortLabel: 'Produits',
    icon: Package,
    bottomBar: true,
  },
  {
    href: '/espace/clients',
    label: 'Clients',
    icon: Contact,
    bottomBar: false,
  },
  {
    href: '/espace/produits/fournisseurs',
    label: 'Fournisseurs',
    icon: Truck,
    bottomBar: false,
  },
  {
    href: '/espace/tresorerie/depenses',
    label: 'Dépenses',
    icon: Banknote,
    bottomBar: false,
    permission: 'treasury.read',
  },
  {
    href: '/espace/tresorerie',
    label: 'Trésorerie / Caisse',
    icon: Wallet,
    bottomBar: false,
    permission: 'treasury.read',
  },
  {
    href: '/espace/statistiques',
    label: 'Rapports / Statistiques',
    icon: ChartColumn,
    bottomBar: false,
    matches: ['/espace/comptabilite'],
    permission: 'stats.read',
  },
  {
    href: '/espace/parametres',
    label: 'Paramètres',
    icon: Settings,
    bottomBar: false,
    matches: ['/espace/equipe', '/espace/journal', '/espace/abonnement'],
  },
];

/** Entries the role may open, named after what the shop sells (ADR-047). */
export function navItemsFor(role: Role, offer: ShopOffer = 'both'): NavItem[] {
  return NAV_ITEMS.filter(
    (item) =>
      (!item.permission || roleHasPermission(role, item.permission)) &&
      (sellsGoods(offer) || item.href !== '/espace/produits/fournisseurs'),
  ).map((item) =>
    item.href === '/espace/produits' && offer !== 'both'
      ? {
          ...item,
          label: CATALOG_TITLES[offer],
          shortLabel: CATALOG_TITLES[offer],
        }
      : item,
  );
}

/** Exact match for the overview, prefix match for sections. */
export function isActive(href: string, pathname: string): boolean {
  if (href === '/espace') return pathname === '/espace';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The entry to mark for a path: the most specific match, so that
 * « Fournisseurs » wins over « Produits et services » on its own pages.
 */
export function activeHref(
  items: readonly NavItem[],
  pathname: string,
): string | null {
  let best: { href: string; length: number } | null = null;
  for (const item of items)
    for (const path of [item.href, ...(item.matches ?? [])])
      if (isActive(path, pathname) && (!best || path.length > best.length))
        best = { href: item.href, length: path.length };
  return best?.href ?? null;
}

/**
 * Where « Retour » leads on a phone: the page above this one, or nothing on
 * the pages reached from the menu (a tab of a section counts as one).
 */
export function parentPath(pathname: string): string | null {
  if (pathname === '/espace' || !pathname.startsWith('/espace/')) return null;
  const tabs = Object.values(SECTION_TABS).flat() as readonly SectionTab[];
  const topLevel = [
    ...NAV_ITEMS.map((item) => item.href),
    ...tabs.flatMap((tab) => [tab.href, ...(tab.paths ?? [])]),
  ];
  if (topLevel.includes(pathname)) return null;
  return pathname.slice(0, pathname.lastIndexOf('/'));
}

export interface SectionTab {
  href: string;
  label: string;
  /** Other paths where the tabs show, with this tab marked. */
  paths?: readonly string[];
  permission?: Permission;
}

/** Tabs at the top of the sections that group several pages. */
export const SECTION_TABS = {
  ventes: [
    { href: '/espace/ventes', label: 'Ventes' },
    {
      href: '/espace/factures',
      label: 'Factures et devis',
      paths: ['/espace/factures/devis'],
      permission: 'documents.read',
    },
  ],
  rapports: [
    {
      href: '/espace/statistiques',
      label: 'Statistiques',
      permission: 'stats.read',
    },
    {
      href: '/espace/comptabilite',
      label: 'Comptabilité',
      permission: 'accounting.read',
    },
  ],
  parametres: [
    { href: '/espace/parametres', label: 'Boutique' },
    { href: '/espace/equipe', label: 'Équipe' },
    { href: '/espace/journal', label: 'Historique' },
    {
      href: '/espace/abonnement',
      label: 'Abonnement',
      permission: 'subscription.read',
    },
  ],
} as const satisfies Record<string, readonly SectionTab[]>;

export type Section = keyof typeof SECTION_TABS;

/** Tabs of a section the role may open. */
export function sectionTabsFor(section: Section, role: Role): SectionTab[] {
  return SECTION_TABS[section].filter(
    (tab: SectionTab) =>
      !tab.permission || roleHasPermission(role, tab.permission),
  );
}
