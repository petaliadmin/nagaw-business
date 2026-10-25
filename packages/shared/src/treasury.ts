import { z } from 'zod';
import { amountSchema } from './catalog.js';
import { MAX_AMOUNT } from './money.js';
import type { MobileMoneyProvider } from './sales.js';

const uuid = z.uuid('Identifiant invalide');
export const isoDaySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (AAAA-MM-JJ)')
  .refine(
    (day) => !Number.isNaN(Date.parse(`${day}T00:00:00Z`)),
    'Date invalide',
  );

// ---------------------------------------------------------------------------
// Cash accounts (ADR-027)
// ---------------------------------------------------------------------------

export const CASH_ACCOUNT_KINDS = ['cash', 'mobile_money', 'bank'] as const;
export type CashAccountKind = (typeof CASH_ACCOUNT_KINDS)[number];

/**
 * Where a payment lands: cash in the cash drawer, Mobile Money on the
 * account of its operator, card, transfer and cheque at the bank. A sale on
 * credit brings no money (null).
 */
export function accountOfPayment(
  method: string,
  provider: MobileMoneyProvider | null,
): { kind: CashAccountKind; provider: MobileMoneyProvider | null } | null {
  if (method === 'cash') return { kind: 'cash', provider: null };
  if (method === 'mobile_money')
    return { kind: 'mobile_money', provider: provider ?? 'other' };
  if (method === 'card' || method === 'bank_transfer' || method === 'cheque')
    return { kind: 'bank', provider: null };
  return null;
}

/** Signed amount: an opening balance or an overdraft may be negative. */
const signedAmountSchema = z
  .number({ error: 'Montant invalide' })
  .int('Montant invalide')
  .min(-MAX_AMOUNT, 'Montant trop élevé')
  .max(MAX_AMOUNT, 'Montant trop élevé');

export const updateCashAccountSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Donnez un nom')
      .max(60, '60 caractères au plus')
      .optional(),
    openingBalance: signedAmountSchema.optional(),
  })
  .strict();
export type UpdateCashAccountInput = z.infer<typeof updateCashAccountSchema>;

export interface CashAccountDto {
  id: string;
  kind: CashAccountKind;
  provider: MobileMoneyProvider | null;
  name: string;
  openingBalance: number;
  /** Opening balance plus every movement up to now. */
  balance: number;
  /** Something ever happened on it (or it is the cash drawer). */
  used: boolean;
}

export interface TreasuryDto {
  accounts: CashAccountDto[];
  total: number;
  /** Money the shop is owed. */
  receivables: { customers: number; invoices: number };
  /** Today in the shop's time zone, with its money in and out. */
  today: { day: string; moneyIn: number; moneyOut: number };
}

export type CashMovementKind =
  | 'sale'
  | 'sale_cancelled'
  | 'repayment'
  | 'invoice_payment'
  | 'expense'
  | 'transfer_in'
  | 'transfer_out'
  | 'closing';

export interface CashMovementDto {
  kind: CashMovementKind;
  /** Signed: money in is positive. */
  amount: number;
  day: string;
  label: string;
  /** Sale, invoice, expense… it comes from. */
  sourceId: string | null;
}

export const periodQuerySchema = z
  .object({ from: isoDaySchema.optional(), to: isoDaySchema.optional() })
  .strict()
  .refine((q) => !q.from || !q.to || q.from <= q.to, {
    path: ['to'],
    message: 'La fin est avant le début',
  })
  .refine(
    (q) =>
      !q.from ||
      !q.to ||
      (Date.parse(q.to) - Date.parse(q.from)) / 86_400_000 <= 366,
    { path: ['to'], message: 'Une période d’un an au plus' },
  );
export type PeriodQuery = z.infer<typeof periodQuerySchema>;

export const movementsQuerySchema = z
  .object({
    accountId: uuid,
    from: isoDaySchema.optional(),
    to: isoDaySchema.optional(),
  })
  .strict();
export type MovementsQuery = z.infer<typeof movementsQuerySchema>;

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

const categoryName = z
  .string()
  .trim()
  .min(1, 'Donnez un nom')
  .max(60, '60 caractères au plus');
const accountCode = z
  .string()
  .trim()
  .regex(/^[1-9][0-9]{1,7}$/, 'Numéro de compte SYSCOHADA attendu (ex. 622)');

export const createExpenseCategorySchema = z
  .object({ name: categoryName, accountCode })
  .strict();
export type CreateExpenseCategoryInput = z.infer<
  typeof createExpenseCategorySchema
>;

export const updateExpenseCategorySchema = z
  .object({
    name: categoryName.optional(),
    accountCode: accountCode.optional(),
    status: z.enum(['active', 'archived']).optional(),
  })
  .strict();
export type UpdateExpenseCategoryInput = z.infer<
  typeof updateExpenseCategorySchema
>;

export interface ExpenseCategoryDto {
  id: string;
  name: string;
  accountCode: string;
  status: 'active' | 'archived';
}

export const createExpenseSchema = z
  .object({
    categoryId: uuid,
    cashAccountId: uuid,
    label: z
      .string()
      .trim()
      .min(1, 'Dites ce qui a été payé')
      .max(120, '120 caractères au plus'),
    amount: amountSchema.positive('Le montant doit être positif'),
    occurredOn: isoDaySchema,
    clientOperationId: uuid,
  })
  .strict();
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const cancelExpenseSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(1, 'Indiquez pourquoi la dépense est annulée')
      .max(500, '500 caractères au plus'),
  })
  .strict();
export type CancelExpenseInput = z.infer<typeof cancelExpenseSchema>;

export interface ExpenseDto {
  id: string;
  category: { id: string; name: string; accountCode: string };
  account: { id: string; name: string };
  label: string;
  amount: number;
  occurredOn: string;
  status: 'recorded' | 'cancelled';
  cancellation: { at: string; reason: string } | null;
  createdBy: { userId: string; email: string };
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Transfers and cash counts
// ---------------------------------------------------------------------------

export const createTransferSchema = z
  .object({
    fromAccountId: uuid,
    toAccountId: uuid,
    amount: amountSchema.positive('Le montant doit être positif'),
    occurredOn: isoDaySchema,
    note: z.string().trim().max(200, '200 caractères au plus').default(''),
    clientOperationId: uuid,
  })
  .strict()
  .refine((t) => t.fromAccountId !== t.toAccountId, {
    path: ['toAccountId'],
    message: 'Choisissez deux caisses différentes',
  });
export type CreateTransferInput = z.infer<typeof createTransferSchema>;

export const createClosingSchema = z
  .object({
    cashAccountId: uuid,
    day: isoDaySchema,
    countedAmount: amountSchema,
    note: z.string().trim().max(500, '500 caractères au plus').default(''),
    clientOperationId: uuid,
  })
  .strict();
export type CreateClosingInput = z.infer<typeof createClosingSchema>;

export const expectedClosingQuerySchema = z
  .object({ cashAccountId: uuid, day: isoDaySchema })
  .strict();

export interface ClosingDto {
  id: string;
  account: { id: string; name: string };
  day: string;
  expectedAmount: number;
  countedAmount: number;
  difference: number;
  note: string;
  closedBy: { userId: string; email: string };
  createdAt: string;
}

/** What the account should hold at the end of the day, before counting. */
export interface ExpectedClosingDto {
  accountId: string;
  day: string;
  expectedAmount: number;
  moneyIn: number;
  moneyOut: number;
  closing: ClosingDto | null;
}

/** Statement of one account over a period. */
export interface CashMovementsDto {
  account: CashAccountDto;
  from: string;
  to: string;
  /** Balance at the start of `from` and at the end of `to`. */
  startBalance: number;
  endBalance: number;
  /** Most recent first; 500 at most. */
  movements: CashMovementDto[];
  /** Last counted day of this account, if any. */
  lastClosingDay: string | null;
}
