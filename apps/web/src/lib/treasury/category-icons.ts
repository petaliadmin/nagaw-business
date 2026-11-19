import {
  CircleEllipsis,
  House,
  Lightbulb,
  Package,
  Phone,
  Stamp,
  Truck,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

/**
 * A picture for each kind of expense, chosen from its SYSCOHADA account
 * (the name can be changed by the shop, the account keeps its meaning).
 * The longest matching prefix wins: 605 is « Eau et électricité » inside
 * the 60 « Achats ».
 */
const BY_ACCOUNT: [prefix: string, icon: LucideIcon][] = [
  ['605', Lightbulb],
  ['60', Package],
  ['61', Truck],
  ['622', House],
  ['624', Wrench],
  ['628', Phone],
  ['64', Stamp],
  ['66', Users],
];

export function categoryIcon(accountCode: string | undefined): LucideIcon {
  if (!accountCode) return CircleEllipsis;
  const match = BY_ACCOUNT.filter(([prefix]) =>
    accountCode.startsWith(prefix),
  ).sort((a, b) => b[0].length - a[0].length)[0];
  return match?.[1] ?? CircleEllipsis;
}
