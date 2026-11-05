import type { SalesChannel, ShopModule, TeamSize } from '@nagaw/shared';
import {
  Banknote,
  Bike,
  Boxes,
  Calculator,
  ChartColumn,
  Coins,
  Ellipsis,
  FileText,
  Hammer,
  HandCoins,
  MessageCircle,
  Pill,
  Shirt,
  ShoppingBag,
  ShoppingBasket,
  Smartphone,
  Store,
  Truck,
  User,
  Users,
  UsersRound,
  UtensilsCrossed,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

/**
 * Words and pictures of the questionnaire (ADR-062). The activities and the
 * goals themselves come from the database; an unknown key gets the shop
 * picture, so a new row needs no release.
 */
export const SECTOR_ICONS: Record<string, LucideIcon> = {
  neighbourhood: Store,
  fashion_beauty: Shirt,
  electronics: Smartphone,
  food: ShoppingBasket,
  pharmacy: Pill,
  hardware: Hammer,
  restaurant: UtensilsCrossed,
  services: Wrench,
  other: Ellipsis,
};

export const GOAL_ICONS: Record<string, LucideIcon> = {
  profit: Coins,
  credit: HandCoins,
  stock: Boxes,
  documents: FileText,
  accounting: Calculator,
  orders: ShoppingBag,
};

export const iconOf = (icons: Record<string, LucideIcon>, key: string) =>
  icons[key] ?? Store;

export const CHANNEL_OPTIONS: {
  value: SalesChannel;
  label: string;
  icon: LucideIcon;
}[] = [
  { value: 'counter', label: 'Au comptoir', icon: Store },
  { value: 'social', label: 'Sur WhatsApp ou Instagram', icon: MessageCircle },
  { value: 'delivery', label: 'Avec livraison', icon: Bike },
];

export const TEAM_OPTIONS: {
  value: TeamSize;
  label: string;
  icon: LucideIcon;
}[] = [
  { value: 'solo', label: 'Je suis seul', icon: User },
  { value: 'small', label: '2 à 5 personnes', icon: Users },
  { value: 'large', label: 'Plus de 5', icon: UsersRound },
];

/** The modules a shop may leave out of its menu. */
export const MODULE_OPTIONS: {
  value: ShopModule;
  label: string;
  hint: string;
  icon: LucideIcon;
}[] = [
  {
    value: 'documents',
    label: 'Factures et devis',
    hint: 'Pour les clients qui demandent un papier',
    icon: FileText,
  },
  {
    value: 'suppliers',
    label: 'Fournisseurs',
    hint: 'Chez qui j’achète ce que je vends',
    icon: Truck,
  },
  {
    value: 'expenses',
    label: 'Dépenses',
    hint: 'Loyer, transport, électricité…',
    icon: Banknote,
  },
  {
    value: 'stats',
    label: 'Statistiques',
    hint: 'Ce que je gagne, ce qui se vend le mieux',
    icon: ChartColumn,
  },
  {
    value: 'accounting',
    label: 'Comptabilité',
    hint: 'Le journal pour le comptable',
    icon: Calculator,
  },
  {
    value: 'orders',
    label: 'Commandes',
    hint: 'Un catalogue en lien pour WhatsApp et Instagram',
    icon: ShoppingBag,
  },
];

/** Never hidden: named on the last screen so nobody fears losing them. */
export const ALWAYS_SHOWN = 'Vendre, produits, clients, caisse et paramètres';
