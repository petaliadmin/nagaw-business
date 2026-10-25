import { z } from 'zod';
import { amountSchema, quantitySchema, UNIT_KEYS } from './catalog.js';
import {
  computeSaleTotals,
  MOBILE_MONEY_PROVIDERS,
  type MobileMoneyProvider,
} from './sales.js';

const uuid = z.uuid('Identifiant invalide');
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (AAAA-MM-JJ)');
const notes = z.string().trim().max(2000, '2000 caractères au plus');

// ---------------------------------------------------------------------------
// Lines and totals
// ---------------------------------------------------------------------------

/**
 * A line of a quote or an invoice: from the catalogue (productId) or free
 * (a service). Prices are taxes included, as at the counter (ADR-023).
 */
export const documentLineSchema = z
  .object({
    productId: uuid.nullable().default(null),
    label: z
      .string()
      .trim()
      .min(1, 'Décrivez la ligne')
      .max(160, '160 caractères au plus'),
    unit: z.enum(UNIT_KEYS, { error: 'Unité inconnue' }),
    quantity: quantitySchema.positive('La quantité doit être positive'),
    unitPrice: amountSchema,
    taxRateBasisPoints: z
      .number()
      .int()
      .min(0)
      .max(10000)
      .nullable()
      .default(null),
  })
  .strict();
export type DocumentLine = z.infer<typeof documentLineSchema>;

/** Totals of a document, taxes included, with the tax by rate. */
export interface DocumentTotals {
  subtotal: number;
  discount: number;
  total: number;
  taxTotal: number;
  /** Total without taxes. */
  totalExcludingTax: number;
  /** Tax included in the total, by rate (basis points). */
  taxByRate: { rateBasisPoints: number; amount: number }[];
  lineTotals: number[];
}

/** Same arithmetic as at the counter, with the tax detailed by rate. */
export function computeDocumentTotals(
  lines: Pick<DocumentLine, 'unitPrice' | 'quantity' | 'taxRateBasisPoints'>[],
  discount: number,
): DocumentTotals {
  const totals = computeSaleTotals(lines, discount);
  const byRate = new Map<number, number>();
  lines.forEach((line, index) => {
    const rate = line.taxRateBasisPoints ?? 0;
    if (rate > 0)
      byRate.set(
        rate,
        (byRate.get(rate) ?? 0) + totals.lines[index]!.taxAmount,
      );
  });
  return {
    subtotal: totals.subtotal,
    discount: totals.discount,
    total: totals.total,
    taxTotal: totals.taxTotal,
    totalExcludingTax: totals.total - totals.taxTotal,
    taxByRate: [...byRate]
      .sort(([a], [b]) => a - b)
      .map(([rateBasisPoints, amount]) => ({ rateBasisPoints, amount })),
    lineTotals: totals.lines.map((line) => line.lineTotal),
  };
}

const documentFields = {
  customerId: uuid,
  lines: z
    .array(documentLineSchema)
    .min(1, 'Ajoutez au moins une ligne')
    .max(200, '200 lignes au plus'),
  discount: amountSchema.default(0),
  notes: notes.default(''),
};

// ---------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------

export const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'refused'] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const createQuoteSchema = z
  .object({
    ...documentFields,
    /** Defaults to today + the shop's quote validity. */
    validUntil: isoDate.nullable().default(null),
    clientOperationId: uuid,
  })
  .strict();
export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;

export const updateQuoteSchema = z
  .object({ ...documentFields, validUntil: isoDate })
  .strict();
export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>;

export const changeQuoteStatusSchema = z
  .object({ status: z.enum(['sent', 'accepted', 'refused']) })
  .strict();

/** Draft → sent → accepted or refused; a draft may also be decided at once. */
export function canChangeQuoteStatus(
  from: QuoteStatus,
  to: QuoteStatus,
): boolean {
  if (to === 'sent') return from === 'draft';
  if (to === 'accepted' || to === 'refused')
    return from === 'draft' || from === 'sent';
  return false;
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

export type InvoiceStatus = 'draft' | 'issued' | 'cancelled';
/** Issued invoices, by what remains to be paid. */
export type InvoicePaymentState = 'unpaid' | 'partially_paid' | 'paid';

export const createInvoiceSchema = z
  .object({
    ...documentFields,
    /** Defaults to the issue date + the shop's payment term. */
    dueDate: isoDate.nullable().default(null),
    clientOperationId: uuid,
  })
  .strict();
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const updateInvoiceSchema = z
  .object({ ...documentFields, dueDate: isoDate.nullable().default(null) })
  .strict();
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;

export const fromSourceSchema = z.object({ clientOperationId: uuid }).strict();

/** Invoice of a sale: the customer is the sale's, or chosen if it had none. */
export const fromSaleSchema = z
  .object({
    customerId: uuid.nullable().default(null),
    clientOperationId: uuid,
  })
  .strict();
export type FromSaleInput = z.infer<typeof fromSaleSchema>;

export const INVOICE_PAYMENT_METHODS = [
  'cash',
  'mobile_money',
  'card',
  'bank_transfer',
  'cheque',
] as const;
export type InvoicePaymentMethod = (typeof INVOICE_PAYMENT_METHODS)[number];

export const invoicePaymentSchema = z
  .object({
    method: z.enum(INVOICE_PAYMENT_METHODS, {
      error: 'Moyen de paiement inconnu',
    }),
    amount: amountSchema.positive('Le montant doit être positif'),
    provider: z.enum(MOBILE_MONEY_PROVIDERS).nullable().default(null),
    reference: z
      .string()
      .trim()
      .max(60, '60 caractères au plus')
      .transform((value) => (value === '' ? null : value))
      .nullable()
      .default(null),
    paidOn: isoDate,
    clientOperationId: uuid,
  })
  .strict()
  .refine((p) => (p.method === 'mobile_money') === (p.provider !== null), {
    path: ['provider'],
    message: 'Choisissez l’opérateur Mobile Money',
  });
export type InvoicePaymentInput = z.infer<typeof invoicePaymentSchema>;

export const cancelInvoiceSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(1, 'Indiquez pourquoi la facture est annulée')
      .max(500, '500 caractères au plus'),
    clientOperationId: uuid,
  })
  .strict();
export type CancelInvoiceInput = z.infer<typeof cancelInvoiceSchema>;

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface DocumentCustomerDto {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  taxId: string;
}

interface DocumentBaseDto {
  id: string;
  /** Null for a draft invoice. */
  number: string | null;
  customer: DocumentCustomerDto;
  lines: (DocumentLine & { lineTotal: number })[];
  notes: string;
  totals: DocumentTotals;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteDto extends DocumentBaseDto {
  number: string;
  status: QuoteStatus;
  /** True once its validity date has passed, if not decided. */
  expired: boolean;
  issueDate: string;
  validUntil: string;
  /** Invoice made from this quote, if any. */
  invoice: { id: string; number: string | null } | null;
}

export interface InvoicePaymentDto {
  id: string;
  method: InvoicePaymentMethod;
  provider: MobileMoneyProvider | null;
  reference: string | null;
  amount: number;
  paidOn: string;
  fromSale: boolean;
}

export interface InvoiceDto extends DocumentBaseDto {
  kind: 'invoice' | 'credit_note';
  status: InvoiceStatus;
  paymentState: InvoicePaymentState;
  issueDate: string | null;
  dueDate: string | null;
  /** True once its due date has passed with something left to pay. */
  overdue: boolean;
  paid: number;
  balance: number;
  payments: InvoicePaymentDto[];
  quote: { id: string; number: string } | null;
  sale: { id: string; saleNumber: number } | null;
  /** Credit note: the invoice it cancels; invoice: its credit note. */
  creditFor: { id: string; number: string | null } | null;
  creditNote: { id: string; number: string | null } | null;
  cancellation: { at: string; reason: string } | null;
}

export interface DocumentListItemDto {
  id: string;
  kind: 'quote' | 'invoice' | 'credit_note';
  number: string | null;
  customerName: string;
  status: QuoteStatus | InvoiceStatus;
  paymentState: InvoicePaymentState | null;
  expired: boolean;
  overdue: boolean;
  total: number;
  balance: number | null;
  date: string;
}

/** Shop identity printed on documents (ADR-026). */
export interface ShopIdentityDto {
  name: string;
  legalName: string;
  address: string;
  phone: string;
  email: string;
  taxId: string;
  tradeRegister: string;
  invoiceFooter: string;
  invoiceDueDays: number;
  quoteValidityDays: number;
}

/** `F-2026-0007`. */
export function formatDocumentNumber(
  kind: 'quote' | 'invoice' | 'credit_note',
  year: number,
  n: number,
): string {
  const letter = kind === 'quote' ? 'D' : kind === 'invoice' ? 'F' : 'A';
  return `${letter}-${year}-${String(n).padStart(4, '0')}`;
}
