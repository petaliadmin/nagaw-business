import { z } from 'zod';
import { MAX_QUANTITY } from './catalog.js';
import {
  roleHasPermission,
  type Permission,
  type Role,
} from './permissions.js';

// ---------------------------------------------------------------------------
// Categories (ADR-036)
// ---------------------------------------------------------------------------

export const NOTIFICATION_CATEGORIES = [
  'stock',
  'controls',
  'credit',
  'activity',
  'summary',
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

interface CategoryRule {
  label: string;
  description: string;
  /** Who may receive it: the same right as reading what it talks about. */
  permission: Permission;
  /** Received without asking, by these roles. */
  defaultRoles: readonly Role[];
}

export const NOTIFICATION_CATEGORY_RULES: Record<
  NotificationCategory,
  CategoryRule
> = {
  stock: {
    label: 'Stock',
    description:
      'Produit bientôt épuisé, épuisé, ou qui se vend trop vite pour le stock.',
    permission: 'catalog.read',
    defaultRoles: ['owner', 'admin', 'member'],
  },
  controls: {
    label: 'Contrôles des ventes',
    description:
      'Stock corrigé par un vendeur, vente à vérifier (prix ou stock), vente refusée à l’envoi.',
    permission: 'sales.cancel',
    defaultRoles: ['owner', 'admin'],
  },
  credit: {
    label: 'Crédits clients',
    description:
      'Client proche de son plafond, client qui ne rembourse plus depuis longtemps.',
    permission: 'sales.read_all',
    defaultRoles: ['owner', 'admin'],
  },
  activity: {
    label: 'Activité de la boutique',
    description:
      'Ventes, factures et dépenses de la journée, regroupées pour ne pas vous déranger à chaque fois.',
    permission: 'treasury.read',
    defaultRoles: ['owner'],
  },
  summary: {
    label: 'Résumé du soir',
    description:
      'Chaque soir : chiffre du jour comparé à la semaine passée, meilleurs produits, factures, dépenses, à réapprovisionner.',
    permission: 'stats.read',
    defaultRoles: ['owner'],
  },
};

/** Categories a role may receive at all. */
export function notificationCategoriesFor(role: Role): NotificationCategory[] {
  return NOTIFICATION_CATEGORIES.filter((category) =>
    roleHasPermission(role, NOTIFICATION_CATEGORY_RULES[category].permission),
  );
}

export const NOTIFICATION_SEVERITIES = ['info', 'warning', 'danger'] as const;
export type NotificationSeverity = (typeof NOTIFICATION_SEVERITIES)[number];

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export interface NotificationDto {
  id: string;
  category: NotificationCategory;
  kind: string;
  severity: NotificationSeverity;
  title: string;
  body: string;
  /** Page of the application to open, if any. */
  link: string | null;
  /** How many events were grouped in it. */
  occurrences: number;
  read: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationListDto {
  items: NotificationDto[];
  unread: number;
  nextCursor: string | null;
}

export const listNotificationsQuerySchema = z
  .object({
    cursor: z.string().max(200).optional(),
    unread: z.enum(['1']).optional(),
  })
  .strict();
export type ListNotificationsQuery = z.infer<
  typeof listNotificationsQuerySchema
>;

export const markNotificationsReadSchema = z
  .object({
    /** Absent: every notification of the person in this shop. */
    ids: z.array(z.uuid('Identifiant invalide')).min(1).max(100).optional(),
  })
  .strict();
export type MarkNotificationsReadInput = z.infer<
  typeof markNotificationsReadSchema
>;

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------

export interface NotificationPreferenceDto {
  category: NotificationCategory;
  enabled: boolean;
  push: boolean;
}

export const updateNotificationPreferencesSchema = z
  .object({
    preferences: z
      .array(
        z
          .object({
            category: z.enum(NOTIFICATION_CATEGORIES),
            enabled: z.boolean(),
            push: z.boolean(),
          })
          .strict(),
      )
      .min(1)
      .max(NOTIFICATION_CATEGORIES.length),
  })
  .strict();
export type UpdateNotificationPreferencesInput = z.infer<
  typeof updateNotificationPreferencesSchema
>;

// ---------------------------------------------------------------------------
// Shop settings (thresholds stored per shop, never in the code)
// ---------------------------------------------------------------------------

const whole = (min: number, max: number, unit: string) =>
  z.coerce
    .number({ error: 'Nombre attendu' })
    .int('Nombre entier attendu')
    .min(min, `Au moins ${min} ${unit}`)
    .max(max, `Au plus ${max} ${unit}`);

export const NOTIFICATION_SETTING_BOUNDS = {
  sellerStockCorrectionMax: { min: 0, max: 100_000 },
  stockForecastDays: { min: 1, max: 60 },
  stockForecastWindowDays: { min: 3, max: 90 },
  creditOverdueDays: { min: 1, max: 365 },
  creditNearLimitPercent: { min: 1, max: 100 },
  dailySummaryHour: { min: 0, max: 23 },
} as const;

const b = NOTIFICATION_SETTING_BOUNDS;

export const updateNotificationSettingsSchema = z
  .object({
    sellerStockCorrectionMax: z.coerce
      .number({ error: 'Nombre attendu' })
      .min(b.sellerStockCorrectionMax.min, 'Au moins 0')
      .max(Math.min(b.sellerStockCorrectionMax.max, MAX_QUANTITY), 'Trop grand')
      .optional(),
    stockForecastDays: whole(
      b.stockForecastDays.min,
      b.stockForecastDays.max,
      'jours',
    ).optional(),
    stockForecastWindowDays: whole(
      b.stockForecastWindowDays.min,
      b.stockForecastWindowDays.max,
      'jours',
    ).optional(),
    creditOverdueDays: whole(
      b.creditOverdueDays.min,
      b.creditOverdueDays.max,
      'jours',
    ).optional(),
    creditNearLimitPercent: whole(
      b.creditNearLimitPercent.min,
      b.creditNearLimitPercent.max,
      '%',
    ).optional(),
    dailySummaryHour: whole(
      b.dailySummaryHour.min,
      b.dailySummaryHour.max,
      'h',
    ).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Aucun réglage à modifier',
  });
export type UpdateNotificationSettingsInput = z.infer<
  typeof updateNotificationSettingsSchema
>;

export interface NotificationSettingsDto {
  sellerStockCorrectionMax: number;
  stockForecastDays: number;
  stockForecastWindowDays: number;
  creditOverdueDays: number;
  creditNearLimitPercent: number;
  dailySummaryHour: number;
}

// ---------------------------------------------------------------------------
// Push (Web Push)
// ---------------------------------------------------------------------------

export const pushSubscriptionSchema = z
  .object({
    endpoint: z
      .url('Adresse invalide')
      .max(1000)
      .refine(
        (url) => url.startsWith('https://'),
        'Adresse sécurisée attendue',
      ),
    keys: z
      .object({
        p256dh: z.string().min(1).max(200),
        auth: z.string().min(1).max(100),
      })
      .strict(),
    label: z.string().trim().max(120).default(''),
  })
  .strict();
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

export const removePushSubscriptionSchema = z
  .object({ endpoint: z.url('Adresse invalide').max(1000) })
  .strict();
export type RemovePushSubscriptionInput = z.infer<
  typeof removePushSubscriptionSchema
>;

export interface PushConfigDto {
  /** Null when push messages are not configured on this server. */
  publicKey: string | null;
}

/** What the service worker receives and shows. */
export interface PushPayload {
  title: string;
  body: string;
  /** Same tag: the phone replaces the previous message of the group. */
  tag: string;
  url: string;
}
