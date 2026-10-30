import { describe, expect, it } from 'vitest';
import {
  accountOfMovement,
  fiscalYearQuerySchema,
  TREASURY_ACCOUNTS,
  splitSaleReceipt,
} from './accounting.js';
import { roleHasPermission } from './permissions.js';

describe('splitSaleReceipt', () => {
  it('books goods on 701 and services on 706', () => {
    expect(
      splitSaleReceipt(1000, { goods: 1000, services: 0 }).map((p) => [
        p.account.code,
        p.amount,
      ]),
    ).toEqual([['701', 1000]]);
    expect(
      splitSaleReceipt(1000, { goods: 0, services: 500 }).map((p) => [
        p.account.code,
        p.amount,
      ]),
    ).toEqual([['706', 1000]]);
  });

  it('shares a partial payment, to the exact franc', () => {
    const parts = splitSaleReceipt(1000, { goods: 1, services: 2 });
    expect(parts.map((p) => p.amount)).toEqual([333, 667]);
    expect(parts.reduce((sum, p) => sum + p.amount, 0)).toBe(1000);
  });

  it('keeps a cancellation negative', () => {
    expect(
      splitSaleReceipt(-900, { goods: 1, services: 2 }).map((p) => p.amount),
    ).toEqual([-300, -600]);
  });

  it('stays on 70 with nothing to go by', () => {
    expect(splitSaleReceipt(500, null)[0]?.account.code).toBe('70');
    expect(
      splitSaleReceipt(500, { goods: 0, services: 0 })[0]?.account.code,
    ).toBe('70');
  });
});

describe('SYSCOHADA accounts of the minimal cash system', () => {
  it('books sales, expenses, transfers and cash differences', () => {
    for (const kind of [
      'sale',
      'sale_cancelled',
      'repayment',
      'invoice_payment',
    ] as const)
      expect(accountOfMovement(kind, 100, null).code).toBe('70');
    expect(
      accountOfMovement('expense', -100, { code: '622', label: 'Loyer' }),
    ).toEqual({ code: '622', label: 'Loyer' });
    expect(accountOfMovement('transfer_in', 100, null).code).toBe('585');
    expect(accountOfMovement('transfer_out', -100, null).code).toBe('585');
    expect(accountOfMovement('closing', 50, null).code).toBe('758');
    expect(accountOfMovement('closing', -50, null).code).toBe('658');
  });

  it('names the treasury accounts', () => {
    expect([
      TREASURY_ACCOUNTS.cash.code,
      TREASURY_ACCOUNTS.mobile_money.code,
      TREASURY_ACCOUNTS.bank.code,
    ]).toEqual(['571', '55', '521']);
  });

  it('reads a fiscal year from the query', () => {
    expect(fiscalYearQuerySchema.safeParse({ year: '2026' })).toMatchObject({
      success: true,
      data: { year: 2026 },
    });
    expect(fiscalYearQuerySchema.safeParse({ year: '26' }).success).toBe(false);
    expect(fiscalYearQuerySchema.safeParse({}).success).toBe(false);
  });

  it('opens the accounts to managers and the accountant only', () => {
    expect(roleHasPermission('viewer', 'accounting.read')).toBe(true);
    expect(roleHasPermission('admin', 'accounting.read')).toBe(true);
    expect(roleHasPermission('member', 'accounting.read')).toBe(false);
  });
});
