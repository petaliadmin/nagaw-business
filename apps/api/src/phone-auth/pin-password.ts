import { createHmac } from 'node:crypto';

/**
 * The Supabase password of a phone account (ADR-058): an HMAC of the number
 * and the 4-digit code under a server secret. Supabase never sees the code,
 * and without the secret nobody can try the 10,000 codes against it: every
 * attempt goes through the API, which counts them. The fixed prefix meets
 * any character rule set on the project (upper, lower, digit, symbol).
 */
export function pinPassword(pepper: string, phone: string, pin: string) {
  const mac = createHmac('sha256', pepper)
    .update(`${phone}:${pin}`)
    .digest('base64url');
  return `Ng1-${mac}`;
}
