import { healthResponseSchema, type HealthResponse } from '@nagaw/shared';

export type ApiHealth =
  | { state: 'up'; data: HealthResponse }
  | { state: 'down'; reason: string }
  | { state: 'not_configured' };

/**
 * Queries the API liveness endpoint and validates the response against the
 * shared contract. Never throws: every failure becomes an explicit state the
 * UI can display.
 */
export async function fetchApiHealth(
  baseUrl: string | undefined,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 3000,
  protectionBypass?: string,
): Promise<ApiHealth> {
  if (!baseUrl) return { state: 'not_configured' };

  let response: Response;
  try {
    response = await fetchImpl(new URL('/api/v1/health', baseUrl), {
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
      headers: protectionBypass
        ? { 'x-vercel-protection-bypass': protectionBypass }
        : undefined,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { state: 'down', reason: `API injoignable (${reason})` };
  }

  if (!response.ok) {
    return { state: 'down', reason: `HTTP ${response.status}` };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    // A 2xx HTML body typically means an access-protection or login page
    // answered instead of the API.
    return {
      state: 'down',
      reason: 'Réponse non JSON (protection d’accès ou mauvaise URL ?)',
    };
  }

  const parsed = healthResponseSchema.safeParse(body);
  if (!parsed.success) {
    return { state: 'down', reason: 'Réponse de santé invalide' };
  }
  return { state: 'up', data: parsed.data };
}
