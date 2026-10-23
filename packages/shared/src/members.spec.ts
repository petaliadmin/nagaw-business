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
  it('normalizes the e-mail before validating it', () => {
    expect(
      createInvitationSchema.parse({
        email: '  Awa@Acme.TEST ',
        role: 'member',
      }),
    ).toEqual({ email: 'awa@acme.test', role: 'member' });
  });

  it('never invites as owner and rejects unknown fields', () => {
    expect(
      createInvitationSchema.safeParse({ email: 'a@b.test', role: 'owner' })
        .success,
    ).toBe(false);
    expect(
      createInvitationSchema.safeParse({
        email: 'a@b.test',
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
