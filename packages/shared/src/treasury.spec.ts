import { describe, expect, it } from 'vitest';
import { roleHasPermission } from './permissions.js';
import { shareBasisPoints } from './stats.js';
import {
  accountOfPayment,
  createClosingSchema,
  createTransferSchema,
  periodQuerySchema,
} from './treasury.js';

const A = '6f1c1b2e-5d7a-4c3e-9f10-2b3c4d5e6f70';
const B = '7a1c1b2e-5d7a-4c3e-9f10-2b3c4d5e6f71';

describe('accounts of payments', () => {
  it('puts each way of paying on its account, credit nowhere', () => {
    expect(accountOfPayment('cash', null)).toEqual({
      kind: 'cash',
      provider: null,
    });
    expect(accountOfPayment('mobile_money', 'wave')).toEqual({
      kind: 'mobile_money',
      provider: 'wave',
    });
    expect(accountOfPayment('mobile_money', null)).toEqual({
      kind: 'mobile_money',
      provider: 'other',
    });
    for (const method of ['card', 'bank_transfer', 'cheque'])
      expect(accountOfPayment(method, null)).toEqual({
        kind: 'bank',
        provider: null,
      });
    expect(accountOfPayment('credit', null)).toBeNull();
  });
});

describe('periods', () => {
  it('accepts a year at most, in order', () => {
    expect(
      periodQuerySchema.safeParse({ from: '2026-01-01', to: '2026-12-31' })
        .success,
    ).toBe(true);
    expect(
      periodQuerySchema.safeParse({ from: '2026-02-01', to: '2026-01-01' })
        .success,
    ).toBe(false);
    expect(
      periodQuerySchema.safeParse({ from: '2024-01-01', to: '2026-01-01' })
        .success,
    ).toBe(false);
    expect(periodQuerySchema.safeParse({ from: '2026-13-45' }).success).toBe(
      false,
    );
  });
});

describe('transfers and counts', () => {
  it('moves money between two different accounts only', () => {
    const base = {
      amount: 100,
      occurredOn: '2026-10-25',
      clientOperationId: A,
    };
    expect(
      createTransferSchema.safeParse({
        ...base,
        fromAccountId: A,
        toAccountId: B,
      }).success,
    ).toBe(true);
    expect(
      createTransferSchema.safeParse({
        ...base,
        fromAccountId: A,
        toAccountId: A,
      }).success,
    ).toBe(false);
  });

  it('counts a drawer that cannot hold less than nothing', () => {
    const base = { cashAccountId: A, day: '2026-10-25', clientOperationId: B };
    expect(
      createClosingSchema.safeParse({ ...base, countedAmount: 0 }).success,
    ).toBe(true);
    expect(
      createClosingSchema.safeParse({ ...base, countedAmount: -1 }).success,
    ).toBe(false);
  });
});

describe('statistics', () => {
  it('rounds a share down, never claiming all of it too early', () => {
    expect(shareBasisPoints(2500, 3250)).toBe(7692);
    expect(shareBasisPoints(9999, 10000)).toBe(9999);
    expect(shareBasisPoints(1, 0)).toBe(0);
  });

  it('shows money to managers and the reader, not to sellers', () => {
    expect(roleHasPermission('owner', 'treasury.manage')).toBe(true);
    expect(roleHasPermission('viewer', 'treasury.read')).toBe(true);
    expect(roleHasPermission('viewer', 'treasury.manage')).toBe(false);
    expect(roleHasPermission('member', 'stats.read')).toBe(false);
    expect(roleHasPermission('member', 'treasury.read')).toBe(false);
  });
});
