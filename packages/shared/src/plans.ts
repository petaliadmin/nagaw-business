import { z } from 'zod';

/** Limits an offer gives a shop (ADR-029); `null`: no limit (ADR-033). */
export interface PlanLimits {
  products: number | null;
  members: number;
  devices: number;
}

/** What a shop uses, counted against its `PlanLimits`. */
export interface PlanUsage {
  products: number;
  members: number;
  devices: number;
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
