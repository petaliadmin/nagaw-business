import { z } from 'zod';
import { amountSchema, quantitySchema, type Unit } from './catalog.js';

const uuid = z.uuid('Identifiant invalide');

// ---------------------------------------------------------------------------
// Totals (computed identically on the device and by the API, ADR-024)
// ---------------------------------------------------------------------------

export interface PricedLine {
  unitPrice: number;
  quantity: number;
  /** Tax included in the price; null: none. */
  taxRateBasisPoints: number | null;
}

export interface SaleTotals {
  lines: { lineTotal: number; taxAmount: number }[];
  subtotal: number;
  discount: number;
  total: number;
  taxTotal: number;
}

/**
 * Prices are taxes included (ADR-023). A line costs unit price × quantity,
 * rounded to the currency unit. The discount is spread over the lines in
 * proportion to their amount (the remainder on the largest line) so that
 * the tax included in each line can be computed on what is really paid.
 */
export function computeSaleTotals(
  lines: PricedLine[],
  discount: number,
): SaleTotals {
  const lineTotals = lines.map((line) =>
    Math.round(line.unitPrice * line.quantity),
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
      taxAmount: rate === 0 ? 0 : Math.round((paid * rate) / (10000 + rate)),
    };
  });
  return {
    lines: computed,
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

export const createSaleSchema = z
  .object({
    clientOperationId: uuid,
    customerId: uuid.nullable().default(null),
    lines: z
      .array(
        z
          .object({
            productId: uuid,
            quantity: quantitySchema.positive('La quantité doit être positive'),
          })
          .strict(),
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
  })
  .strict();
export type SaleListQuery = z.infer<typeof saleListQuerySchema>;

export type SaleStatus = 'completed' | 'cancelled';

export interface SaleLineDto {
  position: number;
  productId: string;
  label: string;
  unit: Unit;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  taxRateBasisPoints: number | null;
  taxAmount: number;
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
}

export interface SalesDaySummaryDto {
  day: string;
  /** Completed sales only. */
  count: number;
  total: number;
  byMethod: Record<PaymentMethod, number>;
  cancelledCount: number;
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

export const createCustomerSchema = z
  .object({
    name: customerName,
    phone: phone.default(''),
    notes: notes.default(''),
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
