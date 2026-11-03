import 'server-only';
import { ACCOUNT_PHONE_RE } from '@nagaw/shared';
import { cookies } from 'next/headers';

const KNOWN_PHONE_COOKIE = 'nagaw_phone';
const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Remembers on this device the number that just signed in (ADR-059): the
 * next sign-in only asks for the secret code. A convenience, never a proof:
 * the code is still checked by the API.
 */
export async function rememberPhone(phone: string) {
  (await cookies()).set(KNOWN_PHONE_COOKIE, phone, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ONE_YEAR,
  });
}

/** The number remembered on this device, if it still looks like one. */
export async function knownPhone(): Promise<string | null> {
  const value = (await cookies()).get(KNOWN_PHONE_COOKIE)?.value;
  return value && ACCOUNT_PHONE_RE.test(value) ? value : null;
}

export async function forgetPhone() {
  (await cookies()).delete(KNOWN_PHONE_COOKIE);
}
