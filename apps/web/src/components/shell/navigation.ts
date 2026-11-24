import {
  roleHasPermission,
  sellsGoods,
  showsSection,
  type Permission,
  type Role,
  type ShopDisplay,
  type ShopOffer,
  type ShopSection,
} from '@nagaw/shared';
import {
  Banknote,
  ChartColumn,
  ClipboardList,
  Contact,
  FileText,
  HandCoins,
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
  /** Shown in the phone bottom bar; the others live under « Menu ». */
  bottomBar: boolean;
  /** Where the bottom bar leads, when it is a filtered view of the page. */
  bottomHref?: string;
  /** Other sections shown as tabs of this entry (see SECTION_TABS). */
  matches?: readonly string[];
  /** Hidden from the roles without it (the API refuses them anyway). */
  permission?: Permission;
  /** Hidden when the shop hides this part of the application (ADR-067). */
  section?: ShopSection;
  /** Shown only once the merchant turns the option on (ADR-072). */
  option?: 'orders';
}

/**
 * Menu in the owner's order (2026-10-25). Every entry points to a page that
 * exists: « Commandes » shows once the shop turns it on (ADR-072), and
 * « Achats » joins it when its module ships (no dead links). Accounting, team, history and subscription are tabs of
 * their section. The phone bottom bar holds at most four of them, around
 * « Caisse » in the middle (ADR-063, DESIGN.md): what a shopkeeper opens
 * every day — today, what was sold, what is left, where the money is. The
 * others, credit included, are in « Menu », in the top bar.
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
    // Never in the bottom bar: the home shortcuts and the Menu (ADR-072).
    href: '/espace/commandes',
    option: 'orders',
    label: 'Commandes',
    icon: ClipboardList,
    bottomBar: false,
    permission: 'orders.read',
  },
  {
    href: '/espace/produits',
    label: 'Produits et services',
    shortLabel: 'Stock',
    icon: Package,
    bottomBar: true,
  },
  {
    href: '/espace/factures',
    section: 'documents',
    label: 'Factures / Devis',
    icon: FileText,
    bottomBar: false,
    permission: 'documents.read',
  },
  {
    href: '/espace/clients',
    section: 'customers',
    label: 'Clients',
    icon: Contact,
    bottomBar: false,
  },
  {
    href: '/espace/produits/fournisseurs',
    section: 'suppliers',
    label: 'Fournisseurs',
    icon: Truck,
    bottomBar: false,
  },
  {
    href: '/espace/tresorerie/depenses',
    section: 'expenses',
    label: 'Dépenses',
    icon: Banknote,
    bottomBar: false,
    permission: 'treasury.read',
  },
  {
    href: '/espace/tresorerie',
    label: 'Trésorerie / Caisse',
    shortLabel: 'Argent',
    icon: Wallet,
    bottomBar: true,
    permission: 'treasury.read',
  },
  {
    href: '/espace/statistiques',
    section: 'reports',
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

/** A shop that hides nothing and counts its stock: the whole application. */
export const FULL_DISPLAY: ShopDisplay = {
  offer: 'both',
  hiddenSections: [],
  countsStockByDefault: true,
};

/** What a shop shows, from its offer alone or from its whole display. */
export function displayOf(shop: ShopOffer | ShopDisplay): ShopDisplay {
  return typeof shop === 'string' ? { ...FULL_DISPLAY, offer: shop } : shop;
}

/**
 * The bottom bar's name of the catalogue (ADR-047, ADR-067): « Services »
 * for a shop of services, « Stock » for a shop that counts it, « Produits »
 * for one that does not.
 */
export function catalogShortLabel(display: ShopDisplay): string {
  if (display.offer === 'services') return CATALOG_TITLES.services;
  return display.countsStockByDefault ? 'Stock' : CATALOG_TITLES.products;
}

/**
 * Entries the role may open, named after what the shop sells (ADR-047),
 * without the parts the shop hides (ADR-067).
 */
export function navItemsFor(
  role: Role,
  shop: ShopOffer | ShopDisplay = 'both',
): NavItem[] {
  const display = displayOf(shop);
  const { offer } = display;
  return NAV_ITEMS.filter(
    (item) =>
      (!item.permission || roleHasPermission(role, item.permission)) &&
      (sellsGoods(offer) || item.href !== '/espace/produits/fournisseurs') &&
      (!item.section || showsSection(display, item.section)) &&
      (item.option !== 'orders' || display.ordersEnabled === true),
  ).map((item) =>
    item.href === '/espace/produits'
      ? {
          ...item,
          label: CATALOG_TITLES[offer],
          shortLabel: catalogShortLabel(display),
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

/** How many entries the phone bottom bar holds beside « Caisse ». */
export const BOTTOM_BAR_MAX = 4;

/** « Ils vous doivent » as an entry of the bottom bar (ADR-067). */
export const CREDIT_ITEM: NavItem = {
  href: '/espace/clients?doivent=1',
  label: 'Ils vous doivent',
  shortLabel: 'Crédit',
  icon: HandCoins,
  bottomBar: true,
  permission: 'customers.read',
  section: 'credit',
  matches: ['/espace/clients'],
};

/**
 * The four places of the phone bottom bar, around « Caisse » (ADR-063),
 * chosen by what the shop does (ADR-067). « Accueil » and « Argent » never
 * move; the two others are what the shop opens every day:
 * - second: « Factures » for a shop of services that makes invoices, where
 *   the work is quoted and invoiced; « Ventes » otherwise;
 * - fourth: « Crédit » for a shop of goods that counts no stock but sells
 *   on credit, where the catalogue is only touched in the caisse; the
 *   catalogue otherwise, named « Stock », « Produits » or « Services ».
 * What leaves the bar stays in « Menu ».
 */
export function barHrefs(
  role: Role,
  shop: ShopOffer | ShopDisplay = 'both',
): string[] {
  const display = displayOf(shop);
  const shows = (section: ShopSection, permission: Permission) =>
    showsSection(display, section) && roleHasPermission(role, permission);
  const second =
    display.offer === 'services' && shows('documents', 'documents.read')
      ? '/espace/factures'
      : '/espace/ventes';
  const fourth =
    sellsGoods(display.offer) &&
    !display.countsStockByDefault &&
    shows('credit', 'customers.read')
      ? CREDIT_ITEM.href
      : '/espace/produits';
  return ['/espace', second, fourth, '/espace/tresorerie'];
}

/**
 * The phone bottom bar for a role: its entries in two halves, « Caisse »
 * between them for who may sell. The entry to mark is the closest one of
 * the bar: « Dépenses » lights « Argent », « Fournisseurs » lights « Stock ».
 */
export function bottomBarFor(
  role: Role,
  shop: ShopOffer | ShopDisplay = 'both',
): { before: NavItem[]; after: NavItem[]; sell: boolean } {
  const all = [...navItemsFor(role, shop), CREDIT_ITEM];
  const items = barHrefs(role, shop).flatMap((href) => {
    const item = all.find((candidate) => candidate.href === href);
    // An entry the role may not open leaves an empty place, never another.
    return item &&
      (!item.permission || roleHasPermission(role, item.permission))
      ? [
          {
            ...item,
            shortLabel:
              item.href === '/espace/factures' ? 'Factures' : item.shortLabel,
          },
        ]
      : [];
  });
  const half = Math.ceil(items.length / 2);
  return {
    before: items.slice(0, half),
    after: items.slice(half),
    sell: roleHasPermission(role, 'sales.create'),
  };
}

/**
 * Where « Retour » leads on a phone: the page above this one, or nothing on
 * the pages reached from the menu (a tab of a section counts as one).
 */
export function parentPath(pathname: string): string | null {
  if (/^\/admin\/boutiques\/[^/]+$/.test(pathname)) return '/admin/boutiques';
  if (pathname === '/espace' || !pathname.startsWith('/espace/')) return null;
  // Opened from the « Paramètres » menu, without tabs since V3 (ADR-063).
  if (SETTINGS_PAGES.includes(pathname)) return '/espace/parametres';
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

/** Pages listed in the « Paramètres » menu that live at their own address. */
const SETTINGS_PAGES: readonly string[] = [
  '/espace/equipe',
  '/espace/journal',
  '/espace/abonnement',
];

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
}

/** Tabs at the top of the sections that group several pages. */
export const SECTION_TABS = {
  factures: [
    {
      href: '/espace/factures',
      label: 'À encaisser',
      permission: 'stats.read',
    },
    { href: '/espace/factures/liste', label: 'Toutes' },
    { href: '/espace/factures/devis', label: 'Devis' },
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
} as const satisfies Record<string, readonly SectionTab[]>;

export type Section = keyof typeof SECTION_TABS;

/** Tabs of a section the role may open. */
export function sectionTabsFor(section: Section, role: Role): SectionTab[] {
  return SECTION_TABS[section].filter(
    (tab: SectionTab) =>
      !tab.permission || roleHasPermission(role, tab.permission),
  );
}
