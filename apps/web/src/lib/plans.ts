import { formatAmount, type PlanDto, type PlanLimits } from '@nagaw/shared';

/** The limits of an offer, in the order and the words shown to people. */
export const PLAN_LIMITS: {
  key: keyof PlanLimits;
  label: string;
  unit: [string, string];
  /** Said after the count where the unit alone is unclear. */
  detail?: string;
}[] = [
  { key: 'products', label: 'Produits', unit: ['produit', 'produits'] },
  {
    key: 'members',
    label: 'Personnes dans l’équipe',
    unit: ['personne', 'personnes'],
    detail: 'dans l’équipe',
  },
  {
    key: 'devices',
    label: 'Téléphones de caisse',
    unit: ['téléphone', 'téléphones'],
    detail: 'de caisse',
  },
];

const formatNumber = (n: number) => new Intl.NumberFormat('fr').format(n);

/** « 3 produits », or « Produits sans limite » (ADR-033). */
export const planCount = (n: number | null, [one, many]: [string, string]) =>
  n === null
    ? `${many.charAt(0).toUpperCase()}${many.slice(1)} sans limite`
    : `${formatNumber(n)} ${n > 1 ? many : one}`;

/** « Gratuit », or « 5 000 F CFA par mois ». */
export function planPrice(plan: PlanDto): string {
  return plan.monthlyPrice === 0
    ? 'Gratuit'
    : `${formatAmount(plan.monthlyPrice, plan.currency)} par mois`;
}
