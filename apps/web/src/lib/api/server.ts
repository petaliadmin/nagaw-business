import 'server-only';
import { apiBaseUrl, apiProtectionBypass } from '../env';
import { createSupabaseServerClient } from '../supabase/server';
import { callApi, type ApiResult, type CallApiOptions } from './call-api';

export type Session =
  | {
      status: 'signed-in';
      userId: string;
      email: string | null;
      /** International digits of a phone account (ADR-058). */
      phone: string | null;
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
    // Supabase puts '' in the claim an account does not have.
    email:
      typeof claims.claims.email === 'string' && claims.claims.email !== ''
        ? claims.claims.email
        : null,
    phone:
      typeof claims.claims.phone === 'string' && claims.claims.phone !== ''
        ? claims.claims.phone
        : null,
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
 * Calls a public route of the API, without a session: the offer grid, or
 * the phone sign-in that opens one (ADR-058).
 */
export async function apiPublic<T>(
  path: string,
  options: Pick<CallApiOptions, 'method' | 'body'> = {},
): Promise<ApiResult<T>> {
  return callApi<T>({
    ...options,
    path,
    baseUrl: apiBaseUrl(),
    protectionBypass: apiProtectionBypass(),
  });
}

/**
 * Binary GET (product photo, document PDF) on behalf of the user. Errors are reduced to
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
    console.error('Fichier indisponible', path, error);
    return { ok: false, status: 502 };
  }
}
