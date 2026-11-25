import {
  formatAmount,
  historyLabel,
  PLAN_MODULE_LABELS,
  PLAN_MODULES,
  type PlanCountedLimit,
  type PlanDto,
  type PlanLimits,
} from '@nagaw/shared';

/** The limits of an offer, in the order and the words shown to people. */
export interface PlanLimitLine {
  key: PlanCountedLimit;
  /** What it counts, in the gauge of the shop. */
  label: string;
  unit: [string, string];
  /** Said after the count where the unit alone is unclear. */
  detail?: string;
  /** Shown in the shop's gauges even without a limit. */
  always?: boolean;
}

/** The counted limits of an offer, in the order of the screens (ADR-075). */
export const PLAN_LIMITS: PlanLimitLine[] = [
  {
    key: 'products',
    label: 'Produits',
    unit: ['produit', 'produits'],
    always: true,
  },
  {
    key: 'members',
    label: 'Personnes dans l’équipe',
    unit: ['personne', 'personnes'],
    detail: 'dans l’équipe',
    always: true,
  },
  {
    key: 'devices',
    label: 'Téléphones de caisse',
    unit: ['téléphone', 'téléphones'],
    detail: 'de caisse',
    always: true,
  },
  { key: 'customers', label: 'Clients', unit: ['client', 'clients'] },
  {
    key: 'suppliers',
    label: 'Fournisseurs',
    unit: ['fournisseur', 'fournisseurs'],
  },
  {
    key: 'salesPerMonth',
    label: 'Ventes ce mois-ci',
    unit: ['vente par mois', 'ventes par mois'],
  },
  {
    key: 'invoicesPerMonth',
    label: 'Factures ce mois-ci',
    unit: ['facture par mois', 'factures par mois'],
  },
  {
    key: 'quotesPerMonth',
    label: 'Devis ce mois-ci',
    unit: ['devis par mois', 'devis par mois'],
  },
];

/**
 * What an offer gives, as the lines of a price grid: its counts, its
 * history and its modules (ADR-075). A line that no offer of the grid
 * limits is left out, so that the grid shows only what tells them apart.
 */
export function planFeatures(
  limits: PlanLimits,
  grid: readonly PlanLimits[],
): { key: string; text: string; included: boolean }[] {
  const lines: { key: string; text: string; included: boolean }[] = [];
  for (const l of PLAN_LIMITS)
    if (l.always || grid.some((g) => g[l.key] !== null)) {
      const n = limits[l.key];
      lines.push({
        key: l.key,
        text: `${planCount(n, l.unit)}${l.detail && n !== null ? ` ${l.detail}` : ''}`,
        included: true,
      });
    }
  if (grid.some((g) => g.historyMonths !== null))
    lines.push({
      key: 'history',
      text:
        limits.historyMonths === null
          ? 'Tout l’historique'
          : `Historique : ${historyLabel(limits.historyMonths)}`,
      included: true,
    });
  lines.push({
    key: 'core',
    text: 'Ventes, caisse hors ligne, factures et devis',
    included: true,
  });
  const varying = PLAN_MODULES.filter((m) =>
    grid.some((g) => !g.modules.includes(m)),
  );
  const common = PLAN_MODULES.filter((m) => !varying.includes(m));
  if (common.length > 0)
    lines.push({
      key: 'modules',
      text: common.map((m) => PLAN_MODULE_LABELS[m]).join(', '),
      included: true,
    });
  for (const m of varying)
    lines.push({
      key: m,
      text: PLAN_MODULE_LABELS[m],
      included: limits.modules.includes(m),
    });
  return lines;
}

const formatNumber = (n: number) => new Intl.NumberFormat('fr').format(n);

/** « 10 produits », or « Produits sans limite » (ADR-033). */
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
