import { z } from 'zod';

/** Parts of the application an offer may leave out (ADR-075). */
export const PLAN_MODULES = [
  'accounting',
  'treasury',
  'orders',
  'statistics',
] as const;
export type PlanModule = (typeof PLAN_MODULES)[number];

export const PLAN_MODULE_LABELS: Record<PlanModule, string> = {
  accounting: 'Comptabilité',
  treasury: 'Trésorerie et dépenses',
  orders: 'Commandes des clients',
  statistics: 'Rapports et statistiques',
};

/** What each module brings, shown when the offer does not include it. */
export const PLAN_MODULE_DESCRIPTIONS: Record<PlanModule, string> = {
  accounting:
    'Le journal et l’état des recettes et dépenses, prêts pour le comptable (SYSCOHADA), à télécharger.',
  treasury:
    'L’argent de chaque caisse et de chaque compte, les dépenses avec leur justificatif et la clôture de caisse.',
  orders:
    'Les commandes de vos clients : avance reçue, date promise, suivi jusqu’à la remise.',
  statistics:
    'Vos meilleurs produits, la marge, et la comparaison d’une période à l’autre.',
};

/**
 * Limits an offer gives a shop (ADR-029, ADR-075); `null`: no limit
 * (ADR-033).
 */
export interface PlanLimits {
  products: number | null;
  members: number;
  devices: number;
  /** Counted over the calendar month, in the shop's time zone. */
  salesPerMonth: number | null;
  invoicesPerMonth: number | null;
  quotesPerMonth: number | null;
  customers: number | null;
  suppliers: number | null;
  /** Months of sales, documents, reports and treasury shown. */
  historyMonths: number | null;
  modules: PlanModule[];
}

/** What a shop uses, counted against its `PlanLimits`. */
export interface PlanUsage {
  products: number;
  members: number;
  devices: number;
  salesThisMonth: number;
  invoicesThisMonth: number;
  quotesThisMonth: number;
  customers: number;
  suppliers: number;
}

/** The counted limits, in the order the screens show them. */
export const PLAN_COUNTED_LIMITS = [
  'products',
  'members',
  'devices',
  'customers',
  'suppliers',
  'salesPerMonth',
  'invoicesPerMonth',
  'quotesPerMonth',
] as const;
export type PlanCountedLimit = (typeof PLAN_COUNTED_LIMITS)[number];

export const PLAN_LIMIT_LABELS: Record<
  PlanCountedLimit | 'historyMonths',
  string
> = {
  products: 'Produits',
  members: 'Personnes',
  devices: 'Téléphones de caisse',
  customers: 'Clients',
  suppliers: 'Fournisseurs',
  salesPerMonth: 'Ventes par mois',
  invoicesPerMonth: 'Factures par mois',
  quotesPerMonth: 'Devis par mois',
  historyMonths: 'Historique',
};

/** Which usage counts against which limit. */
export const USAGE_OF: Record<PlanCountedLimit, keyof PlanUsage> = {
  products: 'products',
  members: 'members',
  devices: 'devices',
  customers: 'customers',
  suppliers: 'suppliers',
  salesPerMonth: 'salesThisMonth',
  invoicesPerMonth: 'invoicesThisMonth',
  quotesPerMonth: 'quotesThisMonth',
};

/** « 12 mois », « 1 an », « Tout » for a history limit. */
export function historyLabel(months: number | null): string {
  if (months === null) return 'Tout l’historique';
  if (months % 12 === 0) return months === 12 ? '1 an' : `${months / 12} ans`;
  return `${months} mois`;
}

/**
 * First day shown by a history of `months` months, `YYYY-MM-DD`, from
 * `today` (the shop's day): the same day `months` months before.
 */
export function historyStart(today: string, months: number | null) {
  if (months === null) return null;
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  const start = new Date(Date.UTC(y, m - 1 - months, d));
  // 31 May - 3 months: the last day of February, not 3 March.
  if (start.getUTCDate() !== d) start.setUTCDate(0);
  return start.toISOString().slice(0, 10);
}

/** What the admin sends to change an offer; null: no limit. */
const whole = (max: number) =>
  z
    .number({ error: 'Écrivez un nombre entier' })
    .int('Écrivez un nombre entier')
    .min(1, 'Au moins 1')
    .max(max, `Au plus ${new Intl.NumberFormat('fr').format(max)}`);
const optionalCap = (max: number) => whole(max).nullable();
export const adminPlanUpdateSchema = z
  .object({
    monthlyPrice: z
      .number({ error: 'Écrivez un montant entier' })
      .int('Écrivez un montant entier')
      .min(0, 'Pas de montant négatif')
      .max(1_000_000_000, 'Montant trop grand'),
    /** Null: twelve months at the monthly price. */
    yearlyPrice: z
      .number({ error: 'Écrivez un montant entier, ou laissez vide' })
      .int('Écrivez un montant entier')
      .min(0, 'Pas de montant négatif')
      .max(100_000_000_000, 'Montant trop grand')
      .nullable(),
    limits: z
      .object({
        products: optionalCap(100_000),
        members: whole(1000),
        devices: whole(1000),
        salesPerMonth: optionalCap(10_000_000),
        invoicesPerMonth: optionalCap(1_000_000),
        quotesPerMonth: optionalCap(1_000_000),
        customers: optionalCap(100_000),
        suppliers: optionalCap(10_000),
        historyMonths: whole(120)
          .min(3, 'Au moins 3 mois : l’Accueil compare deux mois')
          .nullable(),
        modules: z
          .array(z.enum(PLAN_MODULES, { error: 'Module inconnu' }))
          .max(PLAN_MODULES.length)
          .transform((m) => PLAN_MODULES.filter((k) => m.includes(k))),
      })
      .strict(),
  })
  .strict();
export type AdminPlanUpdateInput = z.infer<typeof adminPlanUpdateSchema>;

/** A change made to an offer from the administration (ADR-075). */
export interface PlanRevisionDto {
  id: string;
  planKey: string;
  changedBy: string;
  before: Pick<PlanDto, 'monthlyPrice' | 'yearlyPrice' | 'limits'>;
  after: Pick<PlanDto, 'monthlyPrice' | 'yearlyPrice' | 'limits'>;
  createdAt: string;
}

/** An offer as the administration edits it, with its shops and changes. */
export interface AdminPlanDto extends PlanDto {
  /** The yearly price set in base; null: twelve months. */
  yearlyPriceSet: number | null;
  shops: number;
  revisions: PlanRevisionDto[];
}

export interface PlanDto {
  key: string;
  name: string;
  /** Per month and per shop, in minor units of `currency`. */
  monthlyPrice: number;
  /** For one year at once (ADR-073): twelve months unless set in base. */
  yearlyPrice: number;
  currency: string;
  limits: PlanLimits;
}

/** A paid offer lasts one month, or one year (ADR-073). */
export const SUBSCRIPTION_PERIODS = ['month', 'year'] as const;
export type SubscriptionPeriod = (typeof SUBSCRIPTION_PERIODS)[number];
export const SUBSCRIPTION_PERIOD_LABELS: Record<SubscriptionPeriod, string> = {
  month: '1 mois',
  year: '1 an',
};

/** Price of an offer for a term. */
export const priceFor = (
  plan: Pick<PlanDto, 'monthlyPrice' | 'yearlyPrice'>,
  period: SubscriptionPeriod,
) => (period === 'year' ? plan.yearlyPrice : plan.monthlyPrice);

/** The end of a term started at `from`, in UTC calendar months. */
export function addPeriod(from: Date, period: SubscriptionPeriod): Date {
  const end = new Date(from);
  const day = end.getUTCDate();
  end.setUTCMonth(end.getUTCMonth() + (period === 'year' ? 12 : 1));
  // 31 January + 1 month: the last day of February, not 3 March.
  if (end.getUTCDate() !== day) end.setUTCDate(0);
  return end;
}

/** An invoice of the subscription, to pay to the platform (ADR-073). */
export interface SubscriptionInvoiceDto {
  id: string;
  /** What to write with the payment. */
  reference: string;
  plan: { key: string; name: string };
  period: SubscriptionPeriod;
  amount: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  status: 'pending' | 'paid' | 'cancelled';
  /** Unpaid after this moment, the shop is suspended. */
  dueAt: string;
  paidAt: string | null;
  note: string;
  createdAt: string;
}

/** `AB-` and the first characters of the invoice: written with a payment. */
export const invoiceReference = (id: string) =>
  `AB-${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;

export const subscriptionSettingsSchema = z
  .object({ autoRenew: z.boolean() })
  .strict();
export type SubscriptionSettingsInput = z.infer<
  typeof subscriptionSettingsSchema
>;

export interface SubscriptionDto {
  plan: PlanDto;
  startedAt: string;
  /** What the shop uses today, against `limits` (its caps). */
  usage: PlanUsage;
  limits: PlanLimits;
  pendingRequest: {
    id: string;
    plan: PlanDto;
    period: SubscriptionPeriod;
    createdAt: string;
  } | null;
  /** One month or one year; null end: free offer or lifetime (ADR-073). */
  period: SubscriptionPeriod;
  currentPeriodEnd: string | null;
  autoRenew: boolean;
  lifetime: boolean;
  /** Pending first, then the latest ones. */
  invoices: SubscriptionInvoiceDto[];
  /** Where to pay an offer; null: not offered (ADR-056). */
  payment: { wave: string | null; orangeMoney: string | null };
}

/** What a shop writes with its payment, so that the team finds its request. */
export function paymentReference(requestId: string): string {
  return `NGW-${requestId.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

export const planChangeRequestSchema = z
  .object({
    planKey: z.string().regex(/^[a-z_]{2,30}$/, 'Offre inconnue'),
    period: z.enum(SUBSCRIPTION_PERIODS).default('month'),
  })
  .strict();
export type PlanChangeRequestInput = z.infer<typeof planChangeRequestSchema>;

/**
 * Share of a limit used, in percent, for a gauge (capped at 100); 0 when
 * there is no limit.
 */
export function usagePercent(used: number, limit: number | null): number {
  if (limit === null) return 0;
  if (limit <= 0) return 100;
  return Math.min(100, Math.round((used * 100) / limit));
}
