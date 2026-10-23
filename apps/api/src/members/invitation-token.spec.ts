import { invitationTokenSchema } from '@nagaw/shared';
import {
  generateInvitationToken,
  hashInvitationToken,
} from './invitation-token.js';

describe('invitation tokens', () => {
  it('match the shared token format and are unique', () => {
    const tokens = new Set(
      Array.from({ length: 50 }, () => generateInvitationToken()),
    );
    expect(tokens.size).toBe(50);
    for (const token of tokens) {
      expect(invitationTokenSchema.safeParse(token).success).toBe(true);
    }
  });

  it('hash to 32 bytes, deterministically', () => {
    const token = generateInvitationToken();
    const hash = hashInvitationToken(token);
    expect(hash).toHaveLength(32);
    expect(hash.equals(hashInvitationToken(token))).toBe(true);
    expect(hash.equals(hashInvitationToken(generateInvitationToken()))).toBe(
      false,
    );
  });
});
