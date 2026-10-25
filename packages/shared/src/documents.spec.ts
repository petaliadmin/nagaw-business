import { describe, expect, it } from 'vitest';
import {
  canChangeQuoteStatus,
  computeDocumentTotals,
  formatDocumentNumber,
  invoicePaymentSchema,
} from './documents.js';
import { roleHasPermission } from './permissions.js';

const OP = '6f1c1b2e-5d7a-4c3e-9f10-2b3c4d5e6f70';

describe('document totals', () => {
  it('details the tax included, by rate', () => {
    const totals = computeDocumentTotals(
      [
        { unitPrice: 1180, quantity: 1, taxRateBasisPoints: 1800 },
        { unitPrice: 1180, quantity: 2, taxRateBasisPoints: 1800 },
        { unitPrice: 1000, quantity: 1, taxRateBasisPoints: null },
      ],
      0,
    );
    expect(totals).toMatchObject({
      subtotal: 4540,
      total: 4540,
      taxTotal: 540,
    });
    expect(totals.totalExcludingTax).toBe(4000);
    expect(totals.taxByRate).toEqual([{ rateBasisPoints: 1800, amount: 540 }]);
    expect(totals.lineTotals).toEqual([1180, 2360, 1000]);
  });
});

describe('document numbers', () => {
  it('prefixes by kind and pads to four digits', () => {
    expect(formatDocumentNumber('invoice', 2026, 7)).toBe('F-2026-0007');
    expect(formatDocumentNumber('quote', 2026, 12345)).toBe('D-2026-12345');
    expect(formatDocumentNumber('credit_note', 2027, 1)).toBe('A-2027-0001');
  });
});

describe('quote statuses', () => {
  it('goes from draft to sent, then accepted or refused', () => {
    expect(canChangeQuoteStatus('draft', 'sent')).toBe(true);
    expect(canChangeQuoteStatus('sent', 'accepted')).toBe(true);
    expect(canChangeQuoteStatus('draft', 'refused')).toBe(true);
    expect(canChangeQuoteStatus('sent', 'sent')).toBe(false);
    expect(canChangeQuoteStatus('accepted', 'refused')).toBe(false);
    expect(canChangeQuoteStatus('refused', 'accepted')).toBe(false);
  });
});

describe('invoice payments', () => {
  const base = { amount: 1000, paidOn: '2026-10-24', clientOperationId: OP };
  it('asks for the operator of a Mobile Money payment only', () => {
    expect(
      invoicePaymentSchema.safeParse({ ...base, method: 'cash' }).success,
    ).toBe(true);
    expect(
      invoicePaymentSchema.safeParse({ ...base, method: 'mobile_money' })
        .success,
    ).toBe(false);
    expect(
      invoicePaymentSchema.safeParse({
        ...base,
        method: 'mobile_money',
        provider: 'wave',
      }).success,
    ).toBe(true);
    expect(
      invoicePaymentSchema.safeParse({
        ...base,
        method: 'cheque',
        provider: 'wave',
      }).success,
    ).toBe(false);
  });
});

describe('document permissions', () => {
  it('keeps documents to managers, readable by the reader', () => {
    expect(roleHasPermission('owner', 'documents.manage')).toBe(true);
    expect(roleHasPermission('admin', 'documents.manage')).toBe(true);
    expect(roleHasPermission('member', 'documents.read')).toBe(false);
    expect(roleHasPermission('viewer', 'documents.read')).toBe(true);
    expect(roleHasPermission('viewer', 'documents.manage')).toBe(false);
  });
});
