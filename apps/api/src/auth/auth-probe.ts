export type AuthReadiness =
  'ok' | 'not_configured' | 'no_signing_keys' | 'unreachable';

export const AUTH_PROBE = Symbol('AUTH_PROBE');

export interface AuthProbe {
  check(): Promise<AuthReadiness>;
}

/**
 * Checks that the Supabase project publishes asymmetric signing keys. A
 * project still signing sessions with the legacy HS256 secret exposes an
 * empty JWKS, and the API could not verify any user token.
 */
export class JwksAuthProbe implements AuthProbe {
  constructor(
    private readonly jwksUrl: string | undefined,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async check(): Promise<AuthReadiness> {
    if (!this.jwksUrl) return 'not_configured';
    let body: unknown;
    try {
      const response = await this.fetchImpl(this.jwksUrl, {
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) return 'unreachable';
      body = await response.json();
    } catch {
      return 'unreachable';
    }
    const keys = (body as { keys?: unknown } | null)?.keys;
    return Array.isArray(keys) && keys.length > 0 ? 'ok' : 'no_signing_keys';
  }
}
