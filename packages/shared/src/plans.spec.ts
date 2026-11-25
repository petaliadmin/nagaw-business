import { describe, expect, it } from 'vitest';
import { roleHasPermission } from './permissions.js';
import {
  paymentReference,
  planChangeRequestSchema,
  usagePercent,
  adminPlanUpdateSchema,
  historyLabel,
  historyStart,
} from './plans.js';

describe('offers', () => {
  it('shows how much of a limit is used, never beyond the gauge', () => {
    expect(usagePercent(25, 50)).toBe(50);
    expect(usagePercent(51, 50)).toBe(100);
    expect(usagePercent(0, 0)).toBe(100);
    expect(usagePercent(5000, null)).toBe(0);
  });

  it('reads the offer asked for', () => {
    expect(planChangeRequestSchema.safeParse({ planKey: 'pro' }).success).toBe(
      true,
    );
    expect(
      planChangeRequestSchema.safeParse({ planKey: 'Pro !' }).success,
    ).toBe(false);
  });

  it('lets the owner ask, the managers read', () => {
    expect(roleHasPermission('owner', 'subscription.manage')).toBe(true);
    expect(roleHasPermission('admin', 'subscription.read')).toBe(true);
    expect(roleHasPermission('admin', 'subscription.manage')).toBe(false);
    expect(roleHasPermission('viewer', 'subscription.read')).toBe(false);
  });
});

describe('paymentReference', () => {
  it('is short, and the same for the team and the shop', () => {
    expect(paymentReference('3f9a1c2e-0000-4000-8000-000000000001')).toBe(
      'NGW-3F9A1C',
    );
  });
});

describe('history of an offer (ADR-075)', () => {
  it('starts the same day, months before, or the last day of a short month', () => {
    expect(historyStart('2026-11-25', 3)).toBe('2026-08-25');
    expect(historyStart('2026-05-31', 3)).toBe('2026-02-28');
    expect(historyStart('2026-01-15', 12)).toBe('2025-01-15');
    expect(historyStart('2026-11-25', null)).toBeNull();
  });

  it('says it in months or years', () => {
    expect(historyLabel(3)).toBe('3 mois');
    expect(historyLabel(12)).toBe('1 an');
    expect(historyLabel(24)).toBe('2 ans');
    expect(historyLabel(null)).toBe('Tout l’historique');
  });
});

describe('adminPlanUpdateSchema', () => {
  const limits = {
    products: null,
    members: 2,
    devices: 1,
    salesPerMonth: 300,
    invoicesPerMonth: null,
    quotesPerMonth: null,
    customers: 50,
    suppliers: null,
    historyMonths: 3,
    modules: ['statistics', 'accounting'],
  };

  it('keeps the modules in one order and refuses a history under 3 months', () => {
    const parsed = adminPlanUpdateSchema.parse({
      monthlyPrice: 0,
      yearlyPrice: null,
      limits,
    });
    expect(parsed.limits.modules).toEqual(['accounting', 'statistics']);
    expect(
      adminPlanUpdateSchema.safeParse({
        monthlyPrice: 0,
        yearlyPrice: null,
        limits: { ...limits, historyMonths: 2 },
      }).success,
    ).toBe(false);
    expect(
      adminPlanUpdateSchema.safeParse({
        monthlyPrice: 0,
        yearlyPrice: null,
        limits: { ...limits, modules: ['caisse'] },
      }).success,
    ).toBe(false);
  });
});
