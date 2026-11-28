import { z } from 'zod';
import {
  amountSchema,
  quantitySchema,
  type ProductKind,
  type Unit,
} from './catalog.js';
import type { OrderStatus } from './orders.js';

/**
 * Ma vitrine (ADR-075): the catalogue as a web link. Customers order
 * without an account; the shop confirms; payment and pickup at the shop.
 */

const uuid = z.uuid('Identifiant invalide');
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (AAAA-MM-JJ)');
const text = (max: number) =>
  z.string().trim().max(max, `${max} caractères au plus`);

/** Addresses that would collide with a page or mislead a visitor. */
export const RESERVED_STOREFRONT_SLUGS = [
  'admin',
  'administration',
  'api',
  'aide',
  'app',
  'blog',
  'caisse',
  'compte',
  'connexion',
  'espace',
  'inscription',
  'nagaw',
  'naagaw',
  'support',
  'vitrine',
] as const;

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
const HANDLE_RE = /^[a-z0-9][a-z0-9-]{0,58}[a-z0-9]$/;

/** « Chez Aïssatou & fils » → `chez-aissatou-fils`. */
export function slugify(value: string, maxLength = 40): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
}

export const isStorefrontSlug = (value: string) =>
  SLUG_RE.test(value) &&
  !value.includes('--') &&
  !(RESERVED_STOREFRONT_SLUGS as readonly string[]).includes(value);

export const isArticleHandle = (value: string) => HANDLE_RE.test(value);

export const storefrontSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine(
    isStorefrontSlug,
    '3 à 40 lettres sans accent, chiffres ou tirets, sans tiret au début ni à la fin',
  );

/** What the storefront shows of the stock: words, never a number. */
export const AVAILABILITIES = ['available', 'few', 'sold_out'] as const;
export type Availability = (typeof AVAILABILITIES)[number];

export const AVAILABILITY_LABELS: Record<Availability, string> = {
  available: 'Disponible',
  few: 'Plus que quelques-uns',
  sold_out: 'Épuisé',
};

/**
 * « Plus que quelques-uns » at or under the alert threshold of the
 * product; a service, and a product whose stock is not counted, are
 * always available.
 */
export function availabilityOf(product: {
  kind: ProductKind;
  trackStock: boolean;
  stockQuantity: number;
  lowStockThreshold: number | null;
}): Availability {
  if (product.kind === 'service' || !product.trackStock) return 'available';
  if (product.stockQuantity <= 0) return 'sold_out';
  if (
    product.lowStockThreshold !== null &&
    product.stockQuantity <= product.lowStockThreshold
  )
    return 'few';
  return 'available';
}

export const STOREFRONT_PRICE_MODES = ['shown', 'on_request'] as const;
export type StorefrontPriceMode = (typeof STOREFRONT_PRICE_MODES)[number];

/** Days ahead a customer may choose to come and collect. */
export const STOREFRONT_MAX_DAYS_AHEAD = 30;

/** Reasons a shop gives when it refuses an order, in pills. */
export const DECLINE_REASONS = ['sold_out', 'closed', 'other'] as const;
export type DeclineReason = (typeof DECLINE_REASONS)[number];
export const DECLINE_REASON_LABELS: Record<DeclineReason, string> = {
  sold_out: 'Épuisé',
  closed: 'Fermé ce jour-là',
  other: 'Autre',
};

// --- Settings of the shop ---------------------------------------------------

export const updateStorefrontSchema = z
  .object({
    enabled: z.boolean().optional(),
    slug: storefrontSlugSchema.optional(),
    tagline: text(160).optional(),
    landmark: text(120).optional(),
    hours: text(120).optional(),
    whatsapp: text(30).optional(),
    indexable: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Aucun champ à modifier',
  });
export type UpdateStorefrontInput = z.infer<typeof updateStorefrontSchema>;

export const storefrontArticlesSchema = z
  .object({
    articles: z
      .array(
        z
          .object({
            productId: uuid,
            visible: z.boolean(),
            priceMode: z.enum(STOREFRONT_PRICE_MODES).optional(),
            description: text(300).optional(),
          })
          .strict(),
      )
      .min(1, 'Choisissez au moins un article')
      .max(500, '500 articles au plus'),
  })
  .strict();
export type StorefrontArticlesInput = z.infer<typeof storefrontArticlesSchema>;

export interface StorefrontSettingsDto {
  enabled: boolean;
  /** Null until the storefront is turned on for the first time. */
  slug: string | null;
  /** Proposed from the shop's name when there is none yet. */
  suggestedSlug: string;
  tagline: string;
  landmark: string;
  hours: string;
  /** Empty: the phone of the shop. */
  whatsapp: string;
  indexable: boolean;
  visibleArticles: number;
  articles: number;
  /** Last seven days, today included. */
  week: { visits: number; ordersSent: number; ordersAccepted: number };
  toConfirm: number;
}

export interface StorefrontArticleSettingDto {
  productId: string;
  name: string;
  kind: ProductKind;
  categoryName: string | null;
  salePrice: number;
  openPrice: boolean;
  visible: boolean;
  priceMode: StorefrontPriceMode;
  description: string;
  hasPhoto: boolean;
  availability: Availability;
}

// --- The public storefront --------------------------------------------------

export interface PublicArticleDto {
  handle: string;
  name: string;
  kind: ProductKind;
  category: string | null;
  unit: Unit;
  /** Null: « Prix sur demande ». */
  price: number | null;
  description: string;
  availability: Availability;
  /** Changes with the photo: the address of the image follows it. */
  photoVersion: string | null;
}

export interface PublicStorefrontDto {
  slug: string;
  /** Set when the address asked for is an old one: go to this one. */
  movedTo: string | null;
  name: string;
  tagline: string;
  landmark: string;
  hours: string;
  /** International digits, for a wa.me link; null when unknown. */
  whatsapp: string | null;
  indexable: boolean;
  currency: string;
  timezone: string;
  /** YYYY-MM-DD in the shop's time zone. */
  today: string;
  logoVersion: string | null;
  articles: PublicArticleDto[];
}

/** The honeypot: a field people never see, robots fill. */
export const STOREFRONT_HONEYPOT = 'website';

export const publicOrderSchema = z
  .object({
    clientOperationId: uuid,
    lines: z
      .array(
        z
          .object({
            article: z.string().refine(isArticleHandle, 'Article inconnu'),
            quantity: quantitySchema.positive('La quantité doit être positive'),
            note: text(300).default(''),
          })
          .strict(),
      )
      .min(1, 'Choisissez au moins un article')
      .max(30, '30 articles au plus'),
    dueOn: isoDate,
    dueTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Heure invalide (HH:MM)')
      .nullable()
      .default(null),
    name: text(80).min(2, 'Écrivez votre nom'),
    phone: text(30).refine(
      (value) => value.replace(/\D/g, '').length >= 8,
      'Écrivez un numéro de téléphone complet',
    ),
    note: text(300).default(''),
    [STOREFRONT_HONEYPOT]: z.string().max(200).default(''),
  })
  .strict();
export type PublicOrderInput = z.infer<typeof publicOrderSchema>;

export interface PublicOrderResultDto {
  number: string;
  status: OrderStatus;
  /** Shown once: only its sha256 is kept. */
  trackingToken: string;
}

export interface PublicTrackingDto {
  number: string;
  status: OrderStatus;
  shopName: string;
  slug: string | null;
  landmark: string;
  whatsapp: string | null;
  currency: string;
  /** The first name only. */
  firstName: string;
  dueOn: string;
  dueTime: string | null;
  lines: { label: string; quantity: number; lineTotal: number | null }[];
  /** Lines with a price; the others are given by the shop. */
  itemsTotal: number;
  pricesToCome: boolean;
  declineReason: string | null;
  createdAt: string;
}

// --- Confirming an order ----------------------------------------------------

export const acceptOrderSchema = z
  .object({
    /** An existing customer; null: the person becomes a new customer. */
    customerId: uuid.nullable().default(null),
    /** Prices of the lines « sur demande », by their place in the order. */
    prices: z
      .array(
        z
          .object({
            line: z.number().int().min(0).max(99),
            lineTotal: amountSchema.positive('Tapez le prix'),
          })
          .strict(),
      )
      .max(30)
      .default([]),
  })
  .strict();
export type AcceptOrderInput = z.infer<typeof acceptOrderSchema>;

export const rescheduleOrderSchema = z
  .object({
    dueOn: isoDate,
    dueTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Heure invalide (HH:MM)')
      .nullable()
      .default(null),
  })
  .strict();
export type RescheduleOrderInput = z.infer<typeof rescheduleOrderSchema>;

export const declineOrderSchema = z
  .object({
    reason: z.enum(DECLINE_REASONS, { error: 'Choisissez un motif' }),
    detail: text(200).default(''),
  })
  .strict()
  .refine((d) => d.reason !== 'other' || d.detail !== '', {
    path: ['detail'],
    message: 'Dites pourquoi',
  });
export type DeclineOrderInput = z.infer<typeof declineOrderSchema>;

export const declineReasonText = (input: DeclineOrderInput) =>
  input.reason === 'other'
    ? input.detail
    : input.detail
      ? `${DECLINE_REASON_LABELS[input.reason]} : ${input.detail}`
      : DECLINE_REASON_LABELS[input.reason];

/** The first word of a name: what the tracking page shows. */
export const firstNameOf = (name: string) => name.trim().split(/\s+/)[0] ?? '';

/** The days a customer may pick, in the shop's day: today to +30. */
export function storefrontDueOnAllowed(dueOn: string, today: string): boolean {
  if (dueOn < today) return false;
  const limit = new Date(`${today}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + STOREFRONT_MAX_DAYS_AHEAD);
  return dueOn <= limit.toISOString().slice(0, 10);
}
