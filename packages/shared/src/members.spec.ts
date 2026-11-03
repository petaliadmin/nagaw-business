import { describe, expect, it } from 'vitest';
import {
  createInvitationSchema,
  invitationTokenSchema,
  memberChangeRefusal,
  updateMemberSchema,
} from './members.js';

const owner = { userId: 'u-owner', role: 'owner' as const };
const admin = { userId: 'u-admin', role: 'admin' as const };
const member = { userId: 'u-member', role: 'member' as const };
const otherOwner = { userId: 'u-owner-2', role: 'owner' as const };

describe('memberChangeRefusal', () => {
  it('forbids changing one’s own membership', () => {
    expect(memberChangeRefusal(owner, owner, { role: 'admin' })).toBe(
      'SELF_CHANGE_FORBIDDEN',
    );
    expect(memberChangeRefusal(admin, admin, {})).toBe('SELF_CHANGE_FORBIDDEN');
  });

  it('lets owners manage everyone, including other owners', () => {
    expect(memberChangeRefusal(owner, otherOwner, { role: 'admin' })).toBe(
      null,
    );
    expect(memberChangeRefusal(owner, member, { role: 'owner' })).toBe(null);
  });

  it('keeps admins away from owners and from granting ownership', () => {
    expect(memberChangeRefusal(admin, owner, {})).toBe('OWNER_PROTECTED');
    expect(memberChangeRefusal(admin, member, { role: 'owner' })).toBe(
      'OWNER_PROMOTION_FORBIDDEN',
    );
    expect(memberChangeRefusal(admin, member, { role: 'admin' })).toBe(null);
  });
});

describe('createInvitationSchema', () => {
  it('takes a number in international digits (ADR-058)', () => {
    expect(
      createInvitationSchema.parse({ phone: '221771234567', role: 'member' }),
    ).toEqual({ phone: '221771234567', role: 'member' });
    for (const phone of ['77 123 45 67', '+221771234567', '0771234567']) {
      expect(
        createInvitationSchema.safeParse({ phone, role: 'member' }).success,
      ).toBe(false);
    }
    expect(
      createInvitationSchema.safeParse({ email: 'a@b.test', role: 'member' })
        .success,
    ).toBe(false);
  });

  it('never invites as owner and rejects unknown fields', () => {
    expect(
      createInvitationSchema.safeParse({ phone: '221771234567', role: 'owner' })
        .success,
    ).toBe(false);
    expect(
      createInvitationSchema.safeParse({
        phone: '221771234567',
        role: 'member',
        organizationId: 'x',
      }).success,
    ).toBe(false);
  });
});

describe('updateMemberSchema', () => {
  it('requires at least one change', () => {
    expect(updateMemberSchema.safeParse({}).success).toBe(false);
    expect(updateMemberSchema.safeParse({ status: 'disabled' }).success).toBe(
      true,
    );
  });
});

describe('invitationTokenSchema', () => {
  it('accepts only 43-character base64url tokens', () => {
    expect(invitationTokenSchema.safeParse('a'.repeat(43)).success).toBe(true);
    expect(invitationTokenSchema.safeParse('a'.repeat(42)).success).toBe(false);
    expect(invitationTokenSchema.safeParse(`${'a'.repeat(42)}=`).success).toBe(
      false,
    );
  });
});
