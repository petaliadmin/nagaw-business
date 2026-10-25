import { describe, expect, it } from 'vitest';
import {
  accountOfMovement,
  fiscalYearQuerySchema,
  TREASURY_ACCOUNTS,
} from './accounting.js';
import { roleHasPermission } from './permissions.js';

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
