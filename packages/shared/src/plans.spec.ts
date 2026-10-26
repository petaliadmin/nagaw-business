import { describe, expect, it } from 'vitest';
import { roleHasPermission } from './permissions.js';
import { planChangeRequestSchema, usagePercent } from './plans.js';

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
