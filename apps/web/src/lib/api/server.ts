import 'server-only';
import { apiBaseUrl } from '../env';
import { createSupabaseServerClient } from '../supabase/server';
import { callApi, type ApiResult, type CallApiOptions } from './call-api';

export type Session =
  | {
      status: 'signed-in';
      userId: string;
      email: string | null;
      accessToken: string;
    }
  | { status: 'signed-out' }
  | { status: 'not-configured' };

/** Current Supabase session, with the JWT validated by Supabase. */
export async function getSession(): Promise<Session> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: 'not-configured' };

  const { data: claims, error } = await supabase.auth.getClaims();
  if (error || !claims) return { status: 'signed-out' };
  const { data } = await supabase.auth.getSession();
  if (!data.session) return { status: 'signed-out' };
  return {
    status: 'signed-in',
    userId: claims.claims.sub,
    email: typeof claims.claims.email === 'string' ? claims.claims.email : null,
    accessToken: data.session.access_token,
  };
}

/** Calls the API on behalf of the signed-in user. */
export async function apiAsUser<T>(
  accessToken: string,
  options: Omit<CallApiOptions, 'baseUrl' | 'token'>,
): Promise<ApiResult<T>> {
  return callApi<T>({ ...options, baseUrl: apiBaseUrl(), token: accessToken });
}
