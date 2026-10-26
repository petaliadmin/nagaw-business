import { z } from 'zod';
import type { PlanLimits, PlanUsage } from './plans.js';

/**
 * Platform administration (ADR-030): accounts, offers and aggregates of
 * the shops, never their business content.
 */

const note = z.string().trim().max(500, '500 caractères au plus');

export const adminShopQuerySchema = z
  .object({
    q: z.string().trim().max(120).optional(),
    status: z.enum(['active', 'suspended']).optional(),
  })
  .strict();
export type AdminShopQuery = z.infer<typeof adminShopQuerySchema>;

export const adminSetPlanSchema = z
  .object({
    planKey: z.string().regex(/^[a-z_]{2,30}$/, 'Offre inconnue'),
    note: note.default(''),
  })
  .strict();
export type AdminSetPlanInput = z.infer<typeof adminSetPlanSchema>;

export const adminSuspendSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(1, 'Indiquez pourquoi la boutique est suspendue')
      .max(500, '500 caractères au plus'),
  })
  .strict();
export type AdminSuspendInput = z.infer<typeof adminSuspendSchema>;

export const adminResolveRequestSchema = z
  .object({ note: note.default('') })
  .strict();
export type AdminResolveRequestInput = z.infer<
  typeof adminResolveRequestSchema
>;

export const adminRequestQuerySchema = z
  .object({ status: z.enum(['pending', 'all']).optional() })
  .strict();

export const adminSyncQuerySchema = z
  .object({ days: z.coerce.number().int().min(1).max(90).optional() })
  .strict();

export type AdminAlertKind =
  'sync_rejections' | 'quota' | 'silent_device' | 'plan_request';

export interface AdminAlertDto {
  kind: AdminAlertKind;
  message: string;
  shop: { id: string; name: string } | null;
}

export interface AdminOverviewDto {
  shops: {
    active: number;
    suspended: number;
    createdLast30Days: number;
    byPlan: { key: string; name: string; count: number }[];
  };
  users: { total: number; createdLast30Days: number };
  pendingRequests: number;
  /** Last 7 days. */
  sync: {
    batches: number;
    accepted: number;
    rejected: number;
    rejectionBasisPoints: number;
  };
  alerts: AdminAlertDto[];
}

export interface AdminShopListItemDto {
  id: string;
  name: string;
  status: 'active' | 'suspended';
  plan: { key: string; name: string };
  ownerEmails: string[];
  members: number;
  createdAt: string;
  lastSaleAt: string | null;
}

export interface AdminPlanRequestDto {
  id: string;
  shop: { id: string; name: string };
  from: { key: string; name: string };
  to: { key: string; name: string };
  requestedBy: string;
  status: 'pending' | 'cancelled' | 'done' | 'rejected';
  note: string;
  createdAt: string;
  resolvedAt: string | null;
}

export interface AdminShopDto extends AdminShopListItemDto {
  timezone: string;
  currency: string;
  usage: PlanUsage;
  limits: PlanLimits;
  suspension: { at: string; reason: string } | null;
  devices: {
    id: string;
    label: string;
    lastSyncedAt: string | null;
    revoked: boolean;
  }[];
  requests: AdminPlanRequestDto[];
}

export interface AdminSyncDto {
  days: {
    day: string;
    batches: number;
    accepted: number;
    duplicates: number;
    rejected: number;
  }[];
  /** Most frequent reasons of refusal over the period. */
  reasons: { code: string; count: number; example: string }[];
  silentDevices: {
    shop: { id: string; name: string };
    label: string;
    lastSyncedAt: string | null;
  }[];
}
