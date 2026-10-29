import 'server-only';
import { cookies } from 'next/headers';
import { ACTIVE_ORGANIZATION_COOKIE } from './active-organization';

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Remembers the shop to display; a preference, never an authorization. */
export async function rememberOrganization(organizationId: string) {
  (await cookies()).set(ACTIVE_ORGANIZATION_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ONE_YEAR,
  });
}
