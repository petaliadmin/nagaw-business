import { z } from 'zod';
import type { CashAccountKind, CashMovementKind } from './treasury.js';

/**
 * Accounts of the revised SYSCOHADA chart used by the minimal cash system
 * (SMT, ADR-028). Expenses carry the account of their category.
 */
export const TREASURY_ACCOUNTS: Record<
  CashAccountKind,
  { code: string; label: string }
> = {
  cash: { code: '571', label: 'Caisse' },
  mobile_money: { code: '55', label: 'Monnaie électronique' },
  bank: { code: '521', label: 'Banques' },
};

export const ACCOUNTS = {
  /** A receipt nothing ties to what was sold (ADR-046). */
  sales: { code: '70', label: 'Ventes' },
  goods: { code: '701', label: 'Ventes de marchandises' },
  services: { code: '706', label: 'Services vendus' },
  transfer: { code: '585', label: 'Virements de fonds' },
  cashGain: { code: '758', label: 'Produits divers (excédent de caisse)' },
  cashLoss: { code: '658', label: 'Charges diverses (manquant de caisse)' },
} as const;

/** Account a movement is booked to, from its kind and sign. */
export function accountOfMovement(
  kind: CashMovementKind,
  amount: number,
  expenseAccount: { code: string; label: string } | null,
): { code: string; label: string } {
  switch (kind) {
    case 'sale':
    case 'sale_cancelled':
    case 'repayment':
    case 'invoice_payment':
      return ACCOUNTS.sales;
    case 'expense':
      return expenseAccount ?? ACCOUNTS.cashLoss;
    case 'transfer_in':
    case 'transfer_out':
      return ACCOUNTS.transfer;
    case 'closing':
      return amount >= 0 ? ACCOUNTS.cashGain : ACCOUNTS.cashLoss;
  }
}

/** What was sold behind a receipt, in amounts. */
export interface SaleShare {
  goods: number;
  services: number;
}

/**
 * Splits a sale's receipt between goods and services, in proportion of what
 * was sold (ADR-046): a partial payment is shared the same way. The parts
 * add up to the amount exactly. With nothing to go by, it stays on 70.
 */
export function splitSaleReceipt(
  amount: number,
  share: SaleShare | null,
): { account: { code: string; label: string }; amount: number }[] {
  const base = (share?.goods ?? 0) + (share?.services ?? 0);
  if (!share || base <= 0) return [{ account: ACCOUNTS.sales, amount }];
  const services = Math.round((amount * share.services) / base);
  return [
    { account: ACCOUNTS.goods, amount: amount - services },
    { account: ACCOUNTS.services, amount: services },
  ].filter((part) => part.amount !== 0);
}

export const fiscalYearQuerySchema = z
  .object({
    year: z.coerce
      .number({ error: 'Année invalide' })
      .int('Année invalide')
      .min(2000, 'Année invalide')
      .max(2999, 'Année invalide'),
  })
  .strict();

/** One line of the journal of receipts and expenses. */
export interface JournalEntryDto {
  day: string;
  /** Voucher: ticket, invoice or expense number, empty if none. */
  voucher: string;
  label: string;
  kind: CashMovementKind;
  account: { code: string; label: string };
  cashAccount: { id: string; name: string; code: string };
  /** One of the two is 0. */
  receipt: number;
  expense: number;
}

export interface JournalDto {
  from: string;
  to: string;
  entries: JournalEntryDto[];
  totals: { receipts: number; expenses: number };
  /** More than the 5 000 lines shown: use the CSV export. */
  truncated: boolean;
}

/** End of year statement of the minimal cash system (SMT). */
export interface StatementDto {
  year: number;
  from: string;
  to: string;
  /** The year is not over yet: figures up to today. */
  provisional: boolean;
  receipts: { code: string; label: string; amount: number }[];
  expenses: { code: string; label: string; amount: number }[];
  totals: { receipts: number; expenses: number; result: number };
  treasury: {
    accounts: {
      id: string;
      name: string;
      code: string;
      start: number;
      end: number;
    }[];
    start: number;
    end: number;
  };
  /** Owed to the shop at the end of the period. */
  receivables: { customers: number; invoices: number };
  /** Stock at purchase price; products without one are not valued. */
  stock: { value: number; unvaluedProducts: number };
}
