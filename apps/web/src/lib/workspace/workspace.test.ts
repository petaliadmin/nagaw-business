import type { OrganizationWithRoleDto } from '@nagaw/shared';
import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime } from '../format';
import { auditActionLabel } from '../labels';
import { pickActiveOrganization } from './active-organization';

function org(id: string): OrganizationWithRoleDto {
  return {
    id,
    name: id,
    slug: id,
    status: 'active',
    timezone: 'UTC',
    defaultCurrency: 'XOF',
    invitationTtlHours: 168,
    legalName: '',
    address: '',
    phone: '',
    email: '',
    taxId: '',
    tradeRegister: '',
    invoiceFooter: '',
    invoiceDueDays: 30,
    quoteValidityDays: 30,
    createdAt: '2026-10-20T10:00:00.000Z',
    updatedAt: '2026-10-20T10:00:00.000Z',
    role: 'owner',
    maxDiscountBasisPoints: null,
  };
}

describe('pickActiveOrganization', () => {
  const orgs = [org('a'), org('b')];

  it('honors a cookie naming one of the user’s organizations', () => {
    expect(pickActiveOrganization(orgs, 'b')?.id).toBe('b');
  });

  it('ignores a cookie naming another organization (no tenant hopping)', () => {
    expect(pickActiveOrganization(orgs, 'someone-elses-org')?.id).toBe('a');
  });

  it('falls back to the first organization, or none', () => {
    expect(pickActiveOrganization(orgs, undefined)?.id).toBe('a');
    expect(pickActiveOrganization([], 'a')).toBeUndefined();
  });
});

describe('formatting', () => {
  it('formats dates in French in the organization time zone', () => {
    const iso = '2026-10-20T23:30:00.000Z';
    expect(formatDate(iso, 'UTC')).toBe('20 octobre 2026');
    // Same instant is already the next day in Nairobi (UTC+3).
    expect(formatDate(iso, 'Africa/Nairobi')).toBe('21 octobre 2026');
    expect(formatDateTime(iso, 'UTC')).toMatch(/20 oct\. 2026.*23:30/);
  });

  it('labels known audit actions and shows unknown ones raw', () => {
    expect(auditActionLabel('organization.created')).toBe('Boutique créée');
    expect(auditActionLabel('agent.activated')).toBe('agent.activated');
    expect(auditActionLabel('member.disabled')).toBe(
      'Accès d’une personne désactivé',
    );
    expect(auditActionLabel('invitation.accepted')).toBe('Invitation acceptée');
  });
});
