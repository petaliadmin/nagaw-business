import 'server-only';
import { apiBaseUrl, apiProtectionBypass } from '../env';
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
  options: Omit<CallApiOptions, 'baseUrl' | 'token' | 'protectionBypass'>,
): Promise<ApiResult<T>> {
  return callApi<T>({
    ...options,
    baseUrl: apiBaseUrl(),
    token: accessToken,
    protectionBypass: apiProtectionBypass(),
  });
}

/**
 * Binary GET (product photo) on behalf of the user. Errors are reduced to
 * their HTTP status: the caller only needs to know whether it can show it.
 */
export async function fetchBinaryAsUser(
  accessToken: string,
  path: string,
  organizationId: string,
): Promise<
  | { ok: true; data: ArrayBuffer; contentType: string }
  | { ok: false; status: number }
> {
  const baseUrl = apiBaseUrl();
  if (!baseUrl) return { ok: false, status: 503 };
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'X-Organization-Id': organizationId,
  };
  const bypass = apiProtectionBypass();
  if (bypass) headers['x-vercel-protection-bypass'] = bypass;
  try {
    const response = await fetch(new URL(`/api/v1${path}`, baseUrl), {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return { ok: false, status: response.status };
    return {
      ok: true,
      data: await response.arrayBuffer(),
      contentType:
        response.headers.get('content-type') ?? 'application/octet-stream',
    };
  } catch (error) {
    console.error('Photo indisponible', path, error);
    return { ok: false, status: 502 };
  }
}
