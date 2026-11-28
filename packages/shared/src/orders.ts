import { z } from 'zod';
import { amountSchema, quantitySchema, type Unit } from './catalog.js';
import {
  MOBILE_MONEY_PROVIDERS,
  paymentSchema,
  type MobileMoneyProvider,
} from './sales.js';

/**
 * Customer orders, phase 1 (ADR-072): a sale promised for later, which
 * becomes an ordinary sale at the handover.
 */

const uuid = z.uuid('Identifiant invalide');
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (AAAA-MM-JJ)');
const text = (max: number) =>
  z.string().trim().max(max, `${max} caractères au plus`).default('');

export const ORDER_STATUSES = [
  // Sent from the storefront, waiting for the shop (ADR-075).
  'to_confirm',
  'received',
  'in_preparation',
  'ready',
  'out_for_delivery',
  'delivered',
  'cancelled',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * Statuses of an order accepted and not handed over yet: it can still
 * move. An order « À confirmer » is not one of them: it is accepted or
 * refused first (ADR-075).
 */
export const OPEN_ORDER_STATUSES = [
  'received',
  'in_preparation',
  'ready',
  'out_for_delivery',
] as const satisfies readonly OrderStatus[];
export type OpenOrderStatus = (typeof OPEN_ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  to_confirm: 'À confirmer',
  received: 'Reçue',
  in_preparation: 'En préparation',
  ready: 'Prête',
  out_for_delivery: 'En livraison',
  delivered: 'Remise',
  cancelled: 'Annulée',
};

export const isOpenOrder = (status: OrderStatus): status is OpenOrderStatus =>
  (OPEN_ORDER_STATUSES as readonly string[]).includes(status);

/** « En livraison » is for an order that is delivered. */
export const statusesFor = (
  fulfilment: OrderFulfilment,
): readonly OpenOrderStatus[] =>
  fulfilment === 'delivery'
    ? OPEN_ORDER_STATUSES
    : OPEN_ORDER_STATUSES.filter((s) => s !== 'out_for_delivery');

export const ORDER_FULFILMENTS = ['pickup', 'delivery'] as const;
export type OrderFulfilment = (typeof ORDER_FULFILMENTS)[number];

/** A deposit is real money: never credit. */
export const DEPOSIT_METHODS = ['cash', 'mobile_money', 'card'] as const;
export type DepositMethod = (typeof DEPOSIT_METHODS)[number];

const reference = z
  .string()
  .trim()
  .max(60, '60 caractères au plus')
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .default(null);

const moneyIn = z
  .object({
    method: z.enum(DEPOSIT_METHODS, { error: 'Moyen de paiement inconnu' }),
    provider: z.enum(MOBILE_MONEY_PROVIDERS).nullable().default(null),
    reference,
  })
  .strict();
const providerRule = {
  check: (p: { method: DepositMethod; provider: string | null }) =>
    (p.method === 'mobile_money') === (p.provider !== null),
  message: {
    path: ['provider'],
    message: 'Choisissez l’opérateur Mobile Money',
  },
};

export const orderDepositSchema = moneyIn
  .extend({
    clientOperationId: uuid,
    amount: amountSchema.positive('Le montant doit être positif'),
  })
  .refine(providerRule.check, providerRule.message);
export type OrderDepositInput = z.infer<typeof orderDepositSchema>;

/**
 * A line: a product or a service of the catalogue, at its price unless
 * another was agreed, or a free line « sur mesure » with its own price.
 */
export const orderLineSchema = z
  .object({
    productId: uuid.nullable().default(null),
    /** The name of a free line (« Robe en wax »). */
    label: text(120),
    quantity: quantitySchema.positive('La quantité doit être positive'),
    /** Amount of the line; null: the catalogue price. */
    agreedTotal: amountSchema.nullable().default(null),
    /** Measures, colour, the text on the cake… */
    note: text(300),
  })
  .strict()
  .refine((l) => l.productId !== null || l.label !== '', {
    path: ['label'],
    message: 'Nommez l’article',
  })
  .refine((l) => l.productId !== null || (l.agreedTotal ?? 0) > 0, {
    path: ['agreedTotal'],
    message: 'Tapez le prix de l’article',
  });
export type OrderLineInput = z.infer<typeof orderLineSchema>;

export const createOrderSchema = z
  .object({
    clientOperationId: uuid,
    customerId: uuid,
    lines: z
      .array(orderLineSchema)
      .min(1, 'Ajoutez au moins un article')
      .max(100, '100 articles au plus'),
    dueOn: isoDate,
    /** For a cake at 16:00, an appointment. */
    dueTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Heure invalide (HH:MM)')
      .nullable()
      .default(null),
    fulfilment: z.enum(ORDER_FULFILMENTS),
    deliveryAddress: text(200),
    deliveryLandmark: text(200),
    deliveryPhone: text(30),
    deliveryFee: amountSchema.default(0),
    note: text(500),
    /** Paid with the order: everything, a part, or nothing. */
    deposit: moneyIn
      .extend({ amount: amountSchema.positive('Le montant doit être positif') })
      .refine(providerRule.check, providerRule.message)
      .nullable()
      .default(null),
  })
  .strict()
  .refine((o) => o.fulfilment === 'delivery' || o.deliveryFee === 0, {
    path: ['deliveryFee'],
    message: 'Pas de frais pour un retrait',
  })
  .refine((o) => o.fulfilment === 'pickup' || o.deliveryAddress !== '', {
    path: ['deliveryAddress'],
    message: 'Où faut-il livrer ?',
  });
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const orderStatusSchema = z
  .object({ status: z.enum(OPEN_ORDER_STATUSES) })
  .strict();
export type OrderStatusInput = z.infer<typeof orderStatusSchema>;

/** The handover: what is left is paid now, or on credit. */
export const deliverOrderSchema = z
  .object({
    payments: z.array(paymentSchema).max(5).default([]),
    cashReceived: amountSchema.nullable().default(null),
  })
  .strict();
export type DeliverOrderInput = z.infer<typeof deliverOrderSchema>;

export const cancelOrderSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(1, 'Dites pourquoi la commande est annulée')
      .max(300, '300 caractères au plus'),
    /** How the deposit goes back to the customer, when there is one. */
    refund: moneyIn
      .refine(providerRule.check, providerRule.message)
      .nullable()
      .default(null),
  })
  .strict();
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;

export const orderListQuerySchema = z
  .object({
    /** `open`: not handed over yet (default); `closed`: handed or cancelled. */
    state: z.enum(['open', 'closed']).default('open'),
    customerId: uuid.optional(),
  })
  .strict();
export type OrderListQuery = z.infer<typeof orderListQuerySchema>;

// ---------------------------------------------------------------------------

export interface OrderLineDto {
  productId: string | null;
  /** « Prix sur demande » from the storefront: the shop sets it (ADR-075). */
  priceToSet?: boolean;
  label: string;
  unit: Unit;
  quantity: number;
  /** Frozen when the order is taken. */
  unitPrice: number;
  lineTotal: number;
  note: string;
}

export interface OrderPaymentDto {
  id: string;
  kind: 'deposit' | 'refund';
  method: DepositMethod;
  provider: MobileMoneyProvider | null;
  reference: string | null;
  amount: number;
  createdAt: string;
}

export interface OrderDto {
  id: string;
  number: string;
  status: OrderStatus;
  /** Where it was taken: at the counter, or sent from the storefront. */
  source: OrderSource;
  /** Null for an order « À confirmer », or refused before it was accepted. */
  customer: { id: string; name: string; phone: string } | null;
  /** The person who sent it from the storefront. */
  requester: { name: string; phone: string } | null;
  lines: OrderLineDto[];
  itemsTotal: number;
  deliveryFee: number;
  /** Articles and delivery fee. */
  total: number;
  /** Deposits less refunds: computed, never stored. */
  paid: number;
  remaining: number;
  dueOn: string;
  dueTime: string | null;
  /** Due before today and not handed over. */
  late: boolean;
  fulfilment: OrderFulfilment;
  deliveryAddress: string;
  deliveryLandmark: string;
  deliveryPhone: string;
  note: string;
  payments: OrderPaymentDto[];
  saleId: string | null;
  deliveredAt: string | null;
  cancellation: { at: string; reason: string } | null;
  createdAt: string;
}

export const ORDER_SOURCES = ['counter', 'storefront'] as const;
export type OrderSource = (typeof ORDER_SOURCES)[number];

export interface OrdersSummaryDto {
  /** Sent from the storefront, waiting for the shop (ADR-075). */
  toConfirm: number;
  /** Open orders due today or late: the badge of the shortcut. */
  dueNow: number;
  late: number;
  /** Ready for more than the shop's days, not collected. */
  waitingReady: number;
}

/** Total, paid and what is left, from the parts (ADR-072). */
export function orderTotals(order: {
  itemsTotal: number;
  deliveryFee: number;
  payments: { kind: 'deposit' | 'refund'; amount: number }[];
}): { total: number; paid: number; remaining: number } {
  const total = order.itemsTotal + order.deliveryFee;
  const paid = order.payments.reduce(
    (sum, p) => sum + (p.kind === 'deposit' ? p.amount : -p.amount),
    0,
  );
  return { total, paid, remaining: Math.max(total - paid, 0) };
}

/** A line's amount: what was agreed, otherwise the catalogue price. */
export const orderLineTotal = (
  unitPrice: number,
  quantity: number,
  agreedTotal: number | null,
) => agreedTotal ?? Math.round(unitPrice * quantity);
