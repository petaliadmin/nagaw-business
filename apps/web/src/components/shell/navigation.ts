import {
  Contact,
  House,
  Package,
  Receipt,
  ScrollText,
  Settings,
  ShoppingCart,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the phone bottom bar; the others live under « Plus ». */
  bottomBar: boolean;
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
    href: '/espace/vendre',
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
    href: '/espace/clients',
    label: 'Clients',
    icon: Contact,
    bottomBar: false,
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

/** Exact match for the overview, prefix match for sections. */
export function isActive(href: string, pathname: string): boolean {
  if (href === '/espace') return pathname === '/espace';
  return pathname === href || pathname.startsWith(`${href}/`);
}
