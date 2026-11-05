import { z } from 'zod';
import { MOBILE_MONEY_PROVIDERS, type MobileMoneyProvider } from './sales.js';
import type { Unit } from './catalog.js';
import { formatAmount } from './money.js';
import { pageFields } from './pagination.js';

/**
 * Catalogue in a link and orders from a distance (ADR-063).
 *
 * New → confirmed → shipping → delivered, or cancelled. Being paid is told
 * apart: a customer pays before, or at delivery.
 */
export const ORDER_STATUSES = [
  'new',
  'confirmed',
  'shipping',
  'delivered',
  'cancelled',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Statuses an order may move to from each one. */
export const ORDER_NEXT: Record<OrderStatus, readonly OrderStatus[]> = {
  new: ['confirmed', 'cancelled'],
  confirmed: ['shipping', 'delivered', 'cancelled'],
  shipping: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

export const canMove = (from: OrderStatus, to: OrderStatus) =>
  ORDER_NEXT[from].includes(to);

/** Written by the customer with the payment: `CMD-7K2Q9X`. */
export const ORDER_REFERENCE_RE = /^CMD-[0-9A-Z]{6}$/;

/** An order still to collect: confirmed or on its way, and not paid. */
export const isToRemind = (order: Pick<OrderDto, 'status' | 'paidAt'>) =>
  (order.status === 'confirmed' || order.status === 'shipping') &&
  order.paidAt === null;

const text = (min: number, max: number, message: string) =>
  z.string().trim().min(min, message).max(max, `${max} caractères au plus`);

// ---------------------------------------------------------------------------
// Public page
// ---------------------------------------------------------------------------

export interface PublicProductDto {
  id: string;
  name: string;
  /** Sale price, in minor units of the shop's currency. */
  price: number;
  unit: Unit;
  /** Never the quantity: only whether it can be ordered. */
  available: boolean;
  /** Cache key of the photo; null without photo. */
  photoVersion: string | null;
  category: string | null;
}

export interface PublicShopDto {
  slug: string;
  name: string;
  currency: string;
  phoneCountryCode: string;
  /** Phone of the shop, for « Écrire sur WhatsApp ». */
  phone: string;
  logoVersion: string | null;
  /** A word from the shop: delivery areas, opening hours. */
  note: string;
  payment: { wave: string | null; orangeMoney: string | null };
}

export interface PublicCatalogDto {
  shop: PublicShopDto;
  products: PublicProductDto[];
}

export const publicOrderSchema = z
  .object({
    name: text(2, 120, 'Indiquez votre nom'),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[\d\s().-]{8,30}$/, 'Numéro de téléphone invalide'),
    area: text(2, 160, 'Indiquez votre quartier ou votre adresse'),
    note: z.string().trim().max(500, '500 caractères au plus').default(''),
    lines: z
      .array(
        z
          .object({
            productId: z.uuid({ error: 'Produit inconnu' }),
            quantity: z.coerce
              .number()
              .int('Quantité entière attendue')
              .min(1, 'Au moins 1')
              .max(999, '999 au plus'),
          })
          .strict(),
      )
      .min(1, 'Choisissez au moins un article')
      .max(50, '50 articles au plus')
      .refine(
        (lines) =>
          new Set(lines.map((line) => line.productId)).size === lines.length,
        { message: 'Article en double' },
      ),
    /** Total shown to the customer: a different server total is a conflict. */
    expectedTotal: z.coerce.number().int().min(0),
  })
  .strict();
export type PublicOrderInput = z.infer<typeof publicOrderSchema>;

/** What the customer sees once the order is sent. */
export interface PublicOrderReceiptDto {
  reference: string;
  total: number;
  currency: string;
  lines: { label: string; quantity: number; lineTotal: number }[];
  shop: Pick<
    PublicShopDto,
    'name' | 'phone' | 'phoneCountryCode' | 'payment' | 'note'
  >;
}

// ---------------------------------------------------------------------------
// Shop side
// ---------------------------------------------------------------------------

export interface OrderLineDto {
  position: number;
  productId: string;
  label: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderDto {
  id: string;
  reference: string;
  status: OrderStatus;
  customerName: string;
  /** International digits. */
  customerPhone: string;
  customerArea: string;
  customerNote: string;
  total: number;
  currency: string;
  deliveryFee: number;
  courierName: string;
  courierPhone: string;
  paidAt: string | null;
  payment: {
    method: 'cash' | 'mobile_money';
    provider: MobileMoneyProvider | null;
    reference: string;
  } | null;
  cancelReason: string;
  saleId: string | null;
  confirmedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  lines: OrderLineDto[];
}

/** « À traiter »: new; « En cours »: confirmed or shipping. */
export const ORDER_VIEWS = ['new', 'open', 'remind', 'all'] as const;
export type OrderView = (typeof ORDER_VIEWS)[number];

export const orderListQuerySchema = z
  .object({
    view: z.enum(ORDER_VIEWS).default('open'),
    ...pageFields,
  })
  .strict();
export type OrderListQuery = z.infer<typeof orderListQuerySchema>;

export interface OrderCountsDto {
  new: number;
  open: number;
  remind: number;
}

export const orderPaymentSchema = z
  .object({
    method: z.enum(['cash', 'mobile_money'], { error: 'Moyen inconnu' }),
    provider: z.enum(MOBILE_MONEY_PROVIDERS).nullable().default(null),
    reference: z.string().trim().max(60, '60 caractères au plus').default(''),
  })
  .strict()
  .refine((p) => (p.method === 'mobile_money') === (p.provider !== null), {
    path: ['provider'],
    message: 'Choisissez l’opérateur Mobile Money',
  });
export type OrderPaymentInput = z.infer<typeof orderPaymentSchema>;

export const shipOrderSchema = z
  .object({
    courierName: z.string().trim().max(120, '120 caractères au plus'),
    courierPhone: z
      .string()
      .trim()
      .regex(/^(\+?[\d\s().-]{8,30})?$/, 'Numéro de téléphone invalide'),
    deliveryFee: z.coerce
      .number()
      .int('Montant entier attendu')
      .min(0, 'Montant positif attendu')
      .max(1_000_000_000),
  })
  .strict();
export type ShipOrderInput = z.infer<typeof shipOrderSchema>;

/** At delivery, an unpaid order is paid there and then. */
export const deliverOrderSchema = z
  .object({ payment: orderPaymentSchema.nullable().default(null) })
  .strict();
export type DeliverOrderInput = z.infer<typeof deliverOrderSchema>;

export const cancelOrderSchema = z
  .object({
    reason: text(1, 500, 'Indiquez pourquoi la commande est annulée'),
  })
  .strict();
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;

/** Settings of the public page (ADR-063). */
export const catalogSettingsSchema = z
  .object({
    published: z.boolean(),
    waveNumber: z
      .string()
      .trim()
      .regex(/^[0-9 ]{0,20}$/, 'Chiffres et espaces seulement'),
    orangeMoneyNumber: z
      .string()
      .trim()
      .regex(/^[0-9 ]{0,20}$/, 'Chiffres et espaces seulement'),
    note: z.string().trim().max(300, '300 caractères au plus'),
  })
  .strict();
export type CatalogSettingsInput = z.infer<typeof catalogSettingsSchema>;

export interface CatalogSettingsDto extends CatalogSettingsInput {
  slug: string;
  /** Orders received this month, and the offer's limit (null: none). */
  ordersThisMonth: number;
  maxOrdersPerMonth: number | null;
}

/** Message to the customer for an unpaid order, sent by the seller. */
export function orderReminderText(
  order: Pick<OrderDto, 'customerName' | 'reference' | 'total' | 'currency'>,
  shopName: string,
): string {
  return `Bonjour ${order.customerName}, c’est ${shopName}. Votre commande ${order.reference} de ${formatAmount(order.total, order.currency)} attend votre paiement. Merci d’indiquer la référence ${order.reference} avec le paiement.`;
}

/** Message to the courier: where to go and what to collect. */
export function courierText(
  order: Pick<
    OrderDto,
    | 'reference'
    | 'customerName'
    | 'customerPhone'
    | 'customerArea'
    | 'customerNote'
    | 'total'
    | 'currency'
    | 'paidAt'
    | 'deliveryFee'
  >,
): string {
  const collect =
    order.paidAt === null
      ? `À encaisser : ${formatAmount(order.total, order.currency)}.`
      : 'Déjà payée.';
  const fee =
    order.deliveryFee > 0
      ? ` Livraison : ${formatAmount(order.deliveryFee, order.currency)}.`
      : '';
  const note = order.customerNote ? ` Note : ${order.customerNote}.` : '';
  return `Livraison ${order.reference} : ${order.customerName}, +${order.customerPhone}, ${order.customerArea}. ${collect}${fee}${note}`;
}

/** `7K2Q9X` from random bytes: no 0/O or 1/I confusion is attempted. */
export function orderReference(random: Uint8Array): string {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let out = '';
  for (let i = 0; i < 6; i += 1)
    out += alphabet[(random[i] ?? 0) % alphabet.length];
  return `CMD-${out}`;
}
