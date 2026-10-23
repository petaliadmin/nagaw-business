import 'server-only';
import type { MeDto, OrganizationWithRoleDto } from '@nagaw/shared';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { cache } from 'react';
import { apiAsUser, getSession } from '../api/server';
import {
  ACTIVE_ORGANIZATION_COOKIE,
  pickActiveOrganization,
} from './active-organization';

export type Workspace =
  | { status: 'not-configured' }
  | { status: 'error'; message: string }
  | { status: 'no-organization'; me: MeDto; accessToken: string }
  | {
      status: 'ready';
      me: MeDto;
      organization: OrganizationWithRoleDto;
      accessToken: string;
    };

/**
 * Session, profile and active organization for the current request.
 * Redirects to sign-in when there is no session. Memoized per request so
 * the layout and the page share one API call.
 */
export const loadWorkspace = cache(async (): Promise<Workspace> => {
  // Request-time only: the session, cookies and API data are per user.
  await connection();
  const session = await getSession();
  if (session.status === 'not-configured') return { status: 'not-configured' };
  if (session.status === 'signed-out') redirect('/connexion');

  const me = await apiAsUser<MeDto>(session.accessToken, { path: '/me' });
  if (!me.ok) return { status: 'error', message: me.message };

  const preferred = (await cookies()).get(ACTIVE_ORGANIZATION_COOKIE)?.value;
  const organization = pickActiveOrganization(me.data.organizations, preferred);
  if (!organization) {
    return {
      status: 'no-organization',
      me: me.data,
      accessToken: session.accessToken,
    };
  }
  return {
    status: 'ready',
    me: me.data,
    organization,
    accessToken: session.accessToken,
  };
});

/** For pages: the ready workspace, or null when the shell shows a state. */
export async function requireReadyWorkspace() {
  const workspace = await loadWorkspace();
  return workspace.status === 'ready' ? workspace : null;
}
