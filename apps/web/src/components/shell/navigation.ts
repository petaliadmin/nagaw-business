import { roleHasPermission, type Permission, type Role } from '@nagaw/shared';
import {
  ChartColumn,
  Contact,
  FileText,
  House,
  Package,
  Receipt,
  ScrollText,
  Settings,
  ShoppingCart,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the phone bottom bar; the others live under « Plus ». */
  bottomBar: boolean;
  /** Hidden from the roles without it (the API refuses them anyway). */
  permission?: Permission;
}

/**
 * Every entry points to a page that exists. Shop modules (sales, products,
 * invoices…) are added here only when their page ships (no dead links).
 * The phone bottom bar holds at most three of them next to « Plus », so
 * that labels stay at 16 px on a 360 px screen (DESIGN.md).
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/espace', label: 'Accueil', icon: House, bottomBar: true },
  {
    // Outside /espace: the checkout also opens offline (ADR-020).
    href: '/caisse',
    label: 'Vendre',
    icon: ShoppingCart,
    bottomBar: true,
  },
  {
    href: '/espace/produits',
    label: 'Produits',
    icon: Package,
    bottomBar: true,
  },
  { href: '/espace/ventes', label: 'Ventes', icon: Receipt, bottomBar: false },
  {
    href: '/espace/factures',
    label: 'Factures',
    icon: FileText,
    bottomBar: false,
    permission: 'documents.read',
  },
  {
    href: '/espace/clients',
    label: 'Clients',
    icon: Contact,
    bottomBar: false,
  },
  {
    href: '/espace/statistiques',
    label: 'Statistiques',
    icon: ChartColumn,
    bottomBar: false,
    permission: 'stats.read',
  },
  {
    href: '/espace/tresorerie',
    label: 'Trésorerie',
    icon: Wallet,
    bottomBar: false,
    permission: 'treasury.read',
  },
  { href: '/espace/equipe', label: 'Équipe', icon: Users, bottomBar: false },
  {
    href: '/espace/journal',
    label: 'Historique',
    icon: ScrollText,
    bottomBar: false,
  },
  {
    href: '/espace/parametres',
    label: 'Paramètres',
    icon: Settings,
    bottomBar: false,
  },
];

/** Entries the role may open. */
export function navItemsFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter(
    (item) => !item.permission || roleHasPermission(role, item.permission),
  );
}

/** Exact match for the overview, prefix match for sections. */
export function isActive(href: string, pathname: string): boolean {
  if (href === '/espace') return pathname === '/espace';
  return pathname === href || pathname.startsWith(`${href}/`);
}
