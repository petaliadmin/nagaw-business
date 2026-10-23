import { createHash, randomBytes } from 'node:crypto';

/** New invitation token: 256 random bits, base64url (43 characters). */
export function generateInvitationToken(): string {
  return randomBytes(32).toString('base64url');
}

/** What the database stores and looks up; the token itself is never kept. */
export function hashInvitationToken(token: string): Buffer {
  return createHash('sha256').update(token, 'utf8').digest();
}
