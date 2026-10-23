import { describe, expect, it } from 'vitest';
import { roleHasPermission } from './permissions.js';
import {
  canTransitionResponsibility,
  createResponsibilitySchema,
  responsibilityActivationBlockers,
} from './responsibilities.js';

const MEMBER_ID = '0b9a6f3e-3f0d-4c62-9f2a-1d2b3c4d5e6f';
const base = {
  assigneeUserId: MEMBER_ID,
  title: 'Relance des devis',
  objective: 'Aucun devis sans suivi.',
  scope: '',
  rules: '',
  successCriteria: 'Chaque devis relancé sous 7 jours.',
  maxRunsPerDay: '4',
  escalationUserId: '',
  startsOn: '',
  endsOn: '',
};

describe('createResponsibilitySchema', () => {
  it('turns empty optional inputs into null and coerces numbers', () => {
    const parsed = createResponsibilitySchema.parse(base);
    expect(parsed).toMatchObject({
      maxRunsPerDay: 4,
      escalationUserId: null,
      startsOn: null,
      endsOn: null,
    });
  });

  it('rejects a period that ends before it starts, and extra fields', () => {
    const result = createResponsibilitySchema.safeParse({
      ...base,
      startsOn: '2026-11-10',
      endsOn: '2026-11-01',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['endsOn']);
    expect(
      createResponsibilitySchema.safeParse({ ...base, status: 'active' })
        .success,
    ).toBe(false);
    expect(
      createResponsibilitySchema.safeParse({
        ...base,
        organizationId: MEMBER_ID,
      }).success,
    ).toBe(false);
  });
});

describe('responsibilityActivationBlockers', () => {
  const ready = {
    objective: 'x',
    successCriteria: 'y',
    maxRunsPerDay: 4,
    endsOn: null,
  };

  it('allows an active member with objective and criteria', () => {
    expect(
      responsibilityActivationBlockers(
        ready,
        'active',
        { maxRunsPerDay: 24 },
        '2026-10-23',
      ),
    ).toEqual([]);
  });

  it('lists every blocker', () => {
    expect(
      responsibilityActivationBlockers(
        {
          objective: ' ',
          successCriteria: '',
          maxRunsPerDay: 50,
          endsOn: '2026-10-01',
        },
        'disabled',
        { maxRunsPerDay: 24 },
        '2026-10-23',
      ).map((check) => check.code),
    ).toEqual([
      'ASSIGNEE_NOT_ACTIVE',
      'OBJECTIVE_MISSING',
      'SUCCESS_CRITERIA_MISSING',
      'RUNS_ABOVE_CAP',
      'PERIOD_ENDED',
    ]);
  });
});

describe('responsibility life cycle and permissions', () => {
  it('makes archiving final', () => {
    expect(canTransitionResponsibility('draft', 'active')).toBe(true);
    expect(canTransitionResponsibility('suspended', 'active')).toBe(true);
    expect(canTransitionResponsibility('archived', 'active')).toBe(false);
    expect(canTransitionResponsibility('active', 'draft')).toBe(false);
  });

  it('lets every role read, only owners and admins manage', () => {
    for (const role of ['owner', 'admin', 'member', 'viewer'] as const) {
      expect(roleHasPermission(role, 'responsibilities.read')).toBe(true);
    }
    expect(roleHasPermission('admin', 'responsibilities.manage')).toBe(true);
    expect(roleHasPermission('member', 'responsibilities.manage')).toBe(false);
  });
});
