import { z } from 'zod';
import { pageFields } from './pagination.js';
import {
  amountSchema,
  CONVERSION_CODES,
  formatQuantity,
  quantitySchema,
  UNITS,
  type Unit,
} from './catalog.js';

const uuid = z.uuid('Identifiant invalide');

// ---------------------------------------------------------------------------
// Totals (computed identically on the device and by the API, ADR-024)
// ---------------------------------------------------------------------------

export interface PricedLine {
  unitPrice: number;
  quantity: number;
  /** Tax included in the price; null: none. */
  taxRateBasisPoints: number | null;
  /** Amount agreed with the customer for the line (ADR-038); null: none. */
  agreedTotal?: number | null;
}

export interface SaleTotals {
  lines: {
    lineTotal: number;
    listTotal: number;
    /** What the customer pays for the line, once the discount is shared. */
    paid: number;
    taxAmount: number;
  }[];
  /** What the lines cost at the catalogue prices. */
  listSubtotal: number;
  subtotal: number;
  discount: number;
  total: number;
  taxTotal: number;
}

/** Catalogue amount of a line: unit price × quantity, to the currency unit. */
export function listTotalOf(line: {
  unitPrice: number;
  quantity: number;
}): number {
  return Math.round(line.unitPrice * line.quantity);
}

/**
 * Prices are taxes included (ADR-023). A line costs unit price × quantity,
 * rounded to the currency unit, unless the seller agreed on another amount
 * with the customer (ADR-038). The discount is spread over the lines in
 * proportion to their amount (the remainder on the largest line) so that
 * the tax included in each line can be computed on what is really paid.
 */
export function computeSaleTotals(
  lines: PricedLine[],
  discount: number,
): SaleTotals {
  const listTotals = lines.map(listTotalOf);
  const lineTotals = lines.map(
    (line, index) => line.agreedTotal ?? listTotals[index]!,
  );
  const subtotal = lineTotals.reduce((sum, value) => sum + value, 0);
  const applied = Math.min(Math.max(discount, 0), subtotal);
  const shares = lineTotals.map((value) =>
    subtotal === 0 ? 0 : Math.floor((applied * value) / subtotal),
  );
  const largest = lineTotals.indexOf(Math.max(...lineTotals, 0));
  if (largest >= 0)
    shares[largest]! += applied - shares.reduce((sum, value) => sum + value, 0);

  const computed = lines.map((line, index) => {
    const paid = lineTotals[index]! - shares[index]!;
    const rate = line.taxRateBasisPoints ?? 0;
    return {
      lineTotal: lineTotals[index]!,
      listTotal: listTotals[index]!,
      paid,
      taxAmount: rate === 0 ? 0 : Math.round((paid * rate) / (10000 + rate)),
    };
  });
  return {
    lines: computed,
    listSubtotal: listTotals.reduce((sum, value) => sum + value, 0),
    subtotal,
    discount: applied,
    total: subtotal - applied,
    taxTotal: computed.reduce((sum, line) => sum + line.taxAmount, 0),
  };
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export const PAYMENT_METHODS = [
  'cash',
  'mobile_money',
  'card',
  'credit',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const MOBILE_MONEY_PROVIDERS = [
  'wave',
  'orange_money',
  'free_money',
  'other',
] as const;
export type MobileMoneyProvider = (typeof MOBILE_MONEY_PROVIDERS)[number];

const reference = z
  .string()
  .trim()
  .max(60, '60 caractères au plus')
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .default(null);

export const paymentSchema = z
  .object({
    method: z.enum(PAYMENT_METHODS, { error: 'Moyen de paiement inconnu' }),
    amount: amountSchema.positive('Le montant doit être positif'),
    provider: z.enum(MOBILE_MONEY_PROVIDERS).nullable().default(null),
    /** Transaction number of a Mobile Money payment, typed by the seller. */
    reference,
  })
  .strict()
  .refine((p) => (p.method === 'mobile_money') === (p.provider !== null), {
    path: ['provider'],
    message: 'Choisissez l’opérateur Mobile Money',
  });
export type PaymentInput = z.infer<typeof paymentSchema>;

/**
 * Payments must cover the total exactly; cash may be handed over in excess
 * and the difference is given back. Credit needs a known customer.
 */
export function paymentProblem(input: {
  total: number;
  payments: { method: PaymentMethod; amount: number }[];
  cashReceived: number | null;
  customerId: string | null;
}): { path: string; message: string } | null {
  const paid = input.payments.reduce((sum, p) => sum + p.amount, 0);
  if (paid !== input.total)
    return {
      path: 'payments',
      message: 'Le total des paiements doit être égal au montant à payer.',
    };
  const cash = input.payments
    .filter((p) => p.method === 'cash')
    .reduce((sum, p) => sum + p.amount, 0);
  if (input.cashReceived !== null && cash === 0)
    return {
      path: 'cashReceived',
      message: 'Somme reçue indiquée sans paiement en espèces.',
    };
  if (input.cashReceived !== null && input.cashReceived < cash)
    return {
      path: 'cashReceived',
      message: 'La somme reçue est inférieure au paiement en espèces.',
    };
  if (input.payments.some((p) => p.method === 'credit') && !input.customerId)
    return {
      path: 'customerId',
      message: 'Choisissez le client pour une vente à crédit.',
    };
  return null;
}

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

/** What a sale line says beyond its product (online and offline). */
export const saleLineFields = {
  /** Selling unit of the product (ADR-038)… */
  productUnitId: uuid.nullable().default(null),
  /** …or a standard conversion of its stock unit (`g`); both null: it. */
  conversion: z
    .enum(CONVERSION_CODES, { error: 'Unité inconnue' })
    .nullable()
    .default(null),
  quantity: quantitySchema.positive('La quantité doit être positive'),
  /** Amount agreed with the customer for the line; null: catalogue price. */
  agreedTotal: amountSchema.nullable().default(null),
};

/** A line is sold in one unit: a selling unit or a conversion, not both. */
export const oneUnitPerLine = {
  check: (line: { productUnitId: string | null; conversion: string | null }) =>
    !(line.productUnitId && line.conversion),
  message: { path: ['conversion'], message: 'Une seule unité par ligne' },
};

/**
 * Share of the catalogue amount a sale gives away (negotiated prices and
 * discount), in basis points; 0 when the customer paid more.
 */
export function reductionBasisPoints(
  listSubtotal: number,
  total: number,
): number {
  if (listSubtotal <= 0 || total >= listSubtotal) return 0;
  return Math.ceil(((listSubtotal - total) * 10000) / listSubtotal);
}

export const createSaleSchema = z
  .object({
    clientOperationId: uuid,
    customerId: uuid.nullable().default(null),
    lines: z
      .array(
        z
          .object({
            productId: uuid,
            ...saleLineFields,
          })
          .strict()
          .refine(oneUnitPerLine.check, oneUnitPerLine.message),
      )
      .min(1, 'Le panier est vide')
      .max(200, '200 articles au plus'),
    discount: amountSchema.default(0),
    payments: z.array(paymentSchema).min(1, 'Choisissez un paiement').max(5),
    cashReceived: amountSchema.nullable().default(null),
    /** Total shown to the seller: a different server total is a conflict. */
    expectedTotal: amountSchema,
  })
  .strict();
export type CreateSaleInput = z.infer<typeof createSaleSchema>;

export const cancelSaleSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(1, 'Indiquez pourquoi la vente est annulée')
      .max(500, '500 caractères au plus'),
  })
  .strict();
export type CancelSaleInput = z.infer<typeof cancelSaleSchema>;

export const saleListQuerySchema = z
  .object({
    /** Calendar day in the shop's time zone; today by default. */
    day: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide')
      .optional(),
    /** Every sale the caller may see, whatever the day (newest first). */
    all: z.enum(['true']).optional(),
    ...pageFields,
  })
  .strict();
export type SaleListQuery = z.infer<typeof saleListQuerySchema>;

export type SaleStatus = 'completed' | 'cancelled';

export interface SaleLineDto {
  position: number;
  productId: string;
  label: string;
  /** Stock unit of the product. */
  unit: Unit;
  /** Selling unit (« sac de 50 kg »); null: sold in the stock unit. */
  productUnitId: string | null;
  unitLabel: string | null;
  /** Stock units in one selling unit (1 for the stock unit). */
  unitFactor: number;
  /**
   * Catalogue price of one unit sold (`unit`), or of one stock unit applied
   * to `baseQuantity` (`stock`: a conversion or a unit without a price).
   */
  priceBasis: 'unit' | 'stock';
  unitPrice: number;
  /** In the selling unit. */
  quantity: number;
  /** What left the stock, in the stock unit. */
  baseQuantity: number;
  /** Catalogue amount of the line. */
  listTotal: number;
  /** Amount of the line: the catalogue amount or the negotiated one. */
  lineTotal: number;
  taxRateBasisPoints: number | null;
  taxAmount: number;
}

/** `3 kg`, or `2 × sac de 50 kg` for a selling unit (ADR-038). */
export function formatSoldQuantity(
  line: Pick<SaleLineDto, 'quantity' | 'unit' | 'unitLabel' | 'productUnitId'>,
): string {
  if (!line.unitLabel) return formatQuantity(line.quantity, line.unit);
  const quantity = new Intl.NumberFormat('fr', {
    maximumFractionDigits: 3,
  }).format(line.quantity);
  // « 250 g » for a conversion, « 2 × sac de 50 kg » for a selling unit.
  return line.productUnitId
    ? `${quantity} × ${line.unitLabel}`
    : `${quantity} ${line.unitLabel}`;
}

/** `2 × sac de 50 kg × 30 000 F`, or `250 g à 650 F par kg`. */
export function describeSaleLine(
  line: Pick<
    SaleLineDto,
    | 'quantity'
    | 'unit'
    | 'unitLabel'
    | 'productUnitId'
    | 'priceBasis'
    | 'unitPrice'
  >,
  money: (value: number) => string,
): string {
  return line.priceBasis === 'stock'
    ? `${formatSoldQuantity(line)} à ${money(line.unitPrice)} par ${UNITS[line.unit].label}`
    : `${formatSoldQuantity(line)} × ${money(line.unitPrice)}`;
}

export interface SalePaymentDto {
  method: PaymentMethod;
  provider: MobileMoneyProvider | null;
  reference: string | null;
  amount: number;
}

export interface SaleDto {
  id: string;
  saleNumber: number;
  status: SaleStatus;
  customer: { id: string; name: string; phone: string } | null;
  seller: { userId: string; email: string };
  lines: SaleLineDto[];
  payments: SalePaymentDto[];
  subtotal: number;
  discount: number;
  total: number;
  taxTotal: number;
  cashReceived: number | null;
  changeGiven: number | null;
  occurredAt: string;
  /** Ticket number printed offline by a device (B-000012), if any. */
  deviceTicket: string | null;
  /** Made offline at prices that differed from the catalogue. */
  priceReview: boolean;
  /** Took more goods than the stock the server knew (ADR-036). */
  stockReview: boolean;
  cancellation: {
    at: string;
    by: { userId: string; email: string };
    reason: string;
  } | null;
}

export interface SaleListItemDto {
  id: string;
  saleNumber: number;
  status: SaleStatus;
  customerName: string | null;
  sellerEmail: string;
  itemCount: number;
  total: number;
  methods: PaymentMethod[];
  occurredAt: string;
  deviceTicket: string | null;
  priceReview: boolean;
  stockReview: boolean;
}

export interface SalesDaySummaryDto {
  day: string;
  /** Completed sales only. */
  count: number;
  total: number;
  byMethod: Record<PaymentMethod, number>;
  cancelledCount: number;
}

/** A seller's own figures (ADR-036): never the shop's. */
export interface MySalesStatsDto {
  today: { day: string; count: number; total: number };
  /** The last 7 days, today included, oldest first. */
  days: { day: string; count: number; total: number }[];
  week: { count: number; total: number; averageBasket: number };
  topProducts: {
    productId: string;
    label: string;
    quantity: number;
    total: number;
  }[];
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

const customerName = z
  .string()
  .trim()
  .min(1, 'Donnez le nom du client')
  .max(120, '120 caractères au plus');
const phone = z.string().trim().max(30, '30 caractères au plus');
const notes = z.string().trim().max(1000, '1000 caractères au plus');
const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.union([z.literal(''), z.email('Adresse e-mail invalide').max(320)]));
const address = z.string().trim().max(300, '300 caractères au plus');
/** NINEA or other tax number, for invoices to businesses. */
const taxId = z.string().trim().max(40, '40 caractères au plus');

export const createCustomerSchema = z
  .object({
    name: customerName,
    phone: phone.default(''),
    notes: notes.default(''),
    email: email.default(''),
    address: address.default(''),
    taxId: taxId.default(''),
    creditLimit: amountSchema.nullable().default(null),
    clientOperationId: uuid,
  })
  .strict();
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = z
  .object({
    name: customerName.optional(),
    phone: phone.optional(),
    notes: notes.optional(),
    email: email.optional(),
    address: address.optional(),
    taxId: taxId.optional(),
    creditLimit: amountSchema.nullable().optional(),
    status: z.enum(['active', 'archived']).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Aucun champ à modifier',
  });
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

export const customerRepaymentSchema = z
  .object({
    method: z.enum(['cash', 'mobile_money', 'card'], {
      error: 'Moyen de paiement inconnu',
    }),
    amount: amountSchema.positive('Le montant doit être positif'),
    provider: z.enum(MOBILE_MONEY_PROVIDERS).nullable().default(null),
    reference,
    clientOperationId: uuid,
  })
  .strict()
  .refine((p) => (p.method === 'mobile_money') === (p.provider !== null), {
    path: ['provider'],
    message: 'Choisissez l’opérateur Mobile Money',
  });
export type CustomerRepaymentInput = z.infer<typeof customerRepaymentSchema>;

export interface CustomerDto {
  id: string;
  name: string;
  phone: string;
  notes: string;
  email: string;
  address: string;
  taxId: string;
  creditLimit: number | null;
  /** What the customer owes: credit of completed sales minus repayments. */
  balance: number;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface CustomerActivityDto {
  kind: 'credit_sale' | 'repayment';
  id: string;
  /** Sale number for a credit sale. */
  saleNumber: number | null;
  amount: number;
  method: PaymentMethod | null;
  at: string;
}

export interface CustomerDetailDto extends CustomerDto {
  /** Latest credit sales and repayments, most recent first. */
  activity: CustomerActivityDto[];
}
