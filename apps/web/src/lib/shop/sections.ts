import type { ShopSection } from '@nagaw/shared';
import {
  Banknote,
  ChartColumn,
  Contact,
  FileText,
  HandCoins,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react';

/** The parts a shop may hide (ADR-067), as « Mon application » lists them. */
export const SECTION_OPTIONS: readonly {
  section: ShopSection;
  label: string;
  icon: LucideIcon;
}[] = [
  { section: 'credit', label: 'Ils vous doivent', icon: HandCoins },
  { section: 'expenses', label: 'Dépenses', icon: Banknote },
  { section: 'customers', label: 'Clients', icon: Contact },
  { section: 'documents', label: 'Factures et devis', icon: FileText },
  { section: 'suppliers', label: 'Fournisseurs', icon: Truck },
  { section: 'reports', label: 'Rapports', icon: ChartColumn },
  { section: 'team', label: 'Équipe', icon: Users },
];
