import {
  roleHasPermission,
  sellsGoods,
  showsModule,
  type Permission,
  type Role,
  type ShopModule,
  type ShopOffer,
} from '@nagaw/shared';
import {
  Banknote,
  ChartColumn,
  Contact,
  FileText,
  House,
  Package,
  Receipt,
  Settings,
  ShoppingBag,
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
  /** Left out when the shop hides this module (ADR-062). */
  module?: ShopModule;
}

/**
 * Menu in the owner's order (2026-10-25). Every entry points to a page that
 * exists: « Achats » joins it when its module ships (no dead links);
 * « Commandes » shows when the shop takes orders (ADR-063). Accounting, team, history and subscription are tabs of
 * their section. The phone bottom bar holds at most three entries
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
  },
  {
    href: '/espace/commandes',
    label: 'Commandes',
    icon: ShoppingBag,
    bottomBar: false,
    permission: 'orders.read',
    module: 'orders',
  },
  {
    href: '/espace/produits',
    label: 'Produits et services',
    shortLabel: 'Produits',
    icon: Package,
    bottomBar: true,
  },
  {
    href: '/espace/factures',
    label: 'Factures / Devis',
    icon: FileText,
    bottomBar: false,
    permission: 'documents.read',
    module: 'documents',
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
    module: 'suppliers',
  },
  {
    href: '/espace/tresorerie/depenses',
    label: 'Dépenses',
    icon: Banknote,
    bottomBar: false,
    permission: 'treasury.read',
    module: 'expenses',
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

/**
 * Entries the role may open, named after what the shop sells (ADR-047),
 * without the modules the shop hides (ADR-062). « Rapports » leads to the
 * accounting when the statistics are hidden, and leaves with both.
 */
export function navItemsFor(
  role: Role,
  offer: ShopOffer = 'both',
  hiddenModules: readonly ShopModule[] = [],
): NavItem[] {
  return NAV_ITEMS.map((item) => reportsEntry(item, hiddenModules))
    .filter(
      (item): item is NavItem =>
        item !== null &&
        (!item.permission || roleHasPermission(role, item.permission)) &&
        (!item.module || showsModule(hiddenModules, item.module)) &&
        (sellsGoods(offer) || item.href !== '/espace/produits/fournisseurs'),
    )
    .map((item) =>
      item.href === '/espace/produits' && offer !== 'both'
        ? {
            ...item,
            label: CATALOG_TITLES[offer],
            shortLabel: CATALOG_TITLES[offer],
          }
        : item,
    );
}

function reportsEntry(
  item: NavItem,
  hiddenModules: readonly ShopModule[],
): NavItem | null {
  if (item.href !== '/espace/statistiques') return item;
  const stats = showsModule(hiddenModules, 'stats');
  const accounting = showsModule(hiddenModules, 'accounting');
  if (stats && accounting) return item;
  if (stats) return { ...item, label: 'Statistiques', matches: [] };
  if (accounting)
    return {
      ...item,
      href: '/espace/comptabilite',
      label: 'Comptabilité',
      matches: ['/espace/statistiques'],
      permission: 'accounting.read',
    };
  return null;
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
  if (/^\/admin\/boutiques\/[^/]+$/.test(pathname)) return '/admin/boutiques';
  if (pathname === '/espace' || !pathname.startsWith('/espace/')) return null;
  const tabs = Object.values(SECTION_TABS).flat() as readonly SectionTab[];
  const topLevel = [
    ...NAV_ITEMS.map((item) => item.href),
    ...tabs.flatMap((tab) => [tab.href, ...(tab.paths ?? [])]),
  ];
  if (topLevel.includes(pathname)) return null;
  // An invoice, or a new one, comes from its list, not from its parent path.
  if (/^\/espace\/factures\/[^/]+$/.test(pathname))
    return '/espace/factures/liste';
  return pathname.slice(0, pathname.lastIndexOf('/'));
}

/** Pages that send a form: going back to one would show it again. */
const FORM_PAGE = /\/(nouveau|nouvelle|modifier)$/;

/**
 * The pages seen in this tab, after a move to `pathname`: going back, with
 * « Retour » or the browser's button, takes the last page off.
 */
export function trackPath(
  trail: readonly string[],
  pathname: string,
): string[] {
  if (trail.at(-1) === pathname) return [...trail];
  if (trail.at(-2) === pathname) return trail.slice(0, -1);
  return [...trail, pathname].slice(-50);
}

/** Whether « Retour » may go to the page seen just before. */
export function canGoBack(trail: readonly string[]): boolean {
  const previous = trail.at(-2);
  return previous !== undefined && !FORM_PAGE.test(previous);
}

export interface SectionTab {
  href: string;
  label: string;
  /** Other paths where the tabs show, with this tab marked. */
  paths?: readonly string[];
  permission?: Permission;
  module?: ShopModule;
}

/** Tabs at the top of the sections that group several pages. */
export const SECTION_TABS = {
  factures: [
    { href: '/espace/factures', label: 'Résumé', permission: 'stats.read' },
    { href: '/espace/factures/liste', label: 'Factures' },
    { href: '/espace/factures/devis', label: 'Devis' },
  ],
  rapports: [
    {
      href: '/espace/statistiques',
      label: 'Statistiques',
      permission: 'stats.read',
      module: 'stats',
    },
    {
      href: '/espace/comptabilite',
      label: 'Comptabilité',
      permission: 'accounting.read',
      module: 'accounting',
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

/** Tabs of a section the role may open, without the hidden modules. */
export function sectionTabsFor(
  section: Section,
  role: Role,
  hiddenModules: readonly ShopModule[] = [],
): SectionTab[] {
  return SECTION_TABS[section].filter(
    (tab: SectionTab) =>
      (!tab.permission || roleHasPermission(role, tab.permission)) &&
      (!tab.module || showsModule(hiddenModules, tab.module)),
  );
}
