import { z } from 'zod';

/** Limits an offer gives a shop (ADR-029). */
export interface PlanLimits {
  products: number;
  members: number;
  devices: number;
}

export interface PlanDto {
  key: string;
  name: string;
  /** Per month and per shop, in minor units of `currency`. */
  monthlyPrice: number;
  currency: string;
  limits: PlanLimits;
}

export interface SubscriptionDto {
  plan: PlanDto;
  startedAt: string;
  /** What the shop uses today, against `limits` (its caps). */
  usage: PlanLimits;
  limits: PlanLimits;
  pendingRequest: { id: string; plan: PlanDto; createdAt: string } | null;
}

export const planChangeRequestSchema = z
  .object({ planKey: z.string().regex(/^[a-z_]{2,30}$/, 'Offre inconnue') })
  .strict();
export type PlanChangeRequestInput = z.infer<typeof planChangeRequestSchema>;

/** Share of a limit used, in percent, for a gauge (capped at 100). */
export function usagePercent(used: number, limit: number): number {
  if (limit <= 0) return 100;
  return Math.min(100, Math.round((used * 100) / limit));
}
