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
): Promise<ApiHealth> {
  if (!baseUrl) return { state: 'not_configured' };

  let response: Response;
  try {
    response = await fetchImpl(new URL('/api/v1/health', baseUrl), {
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { state: 'down', reason: `API injoignable (${reason})` };
  }

  if (!response.ok) {
    return { state: 'down', reason: `HTTP ${response.status}` };
  }

  const parsed = healthResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    return { state: 'down', reason: 'Réponse de santé invalide' };
  }
  return { state: 'up', data: parsed.data };
}
