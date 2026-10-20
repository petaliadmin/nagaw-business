import { HttpStatus } from '@nestjs/common';
import { errors, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { ApiException } from '../common/api-exception.js';
import type { AuthContext } from '../common/request-context.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const JWT_VERIFIER = Symbol('JWT_VERIFIER');

export interface JwtVerifier {
  verify(token: string): Promise<AuthContext>;
}

/**
 * Verifies Supabase access tokens: signature against the project JWKS,
 * issuer, audience, expiry, and that the subject is a real (non-anonymous)
 * user.
 */
export class SupabaseJwtVerifier implements JwtVerifier {
  constructor(
    private readonly getKey: JWTVerifyGetKey,
    private readonly issuer: string,
  ) {}

  async verify(token: string): Promise<AuthContext> {
    let payload;
    try {
      ({ payload } = await jwtVerify(token, this.getKey, {
        issuer: this.issuer,
        audience: 'authenticated',
        algorithms: ['ES256', 'RS256', 'EdDSA'],
      }));
    } catch (error) {
      if (error instanceof errors.JOSEError) {
        throw unauthenticated(
          error instanceof errors.JWTExpired
            ? 'Session expirée.'
            : 'Jeton d’authentification invalide.',
        );
      }
      throw error;
    }

    if (payload.role !== 'authenticated' || payload.is_anonymous === true) {
      throw unauthenticated('Jeton d’authentification invalide.');
    }
    if (typeof payload.sub !== 'string' || !UUID_RE.test(payload.sub)) {
      throw unauthenticated('Jeton d’authentification invalide.');
    }
    return {
      userId: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : null,
    };
  }
}

/** Used when SUPABASE_URL is absent: authentication is impossible, say so. */
export class UnconfiguredJwtVerifier implements JwtVerifier {
  verify(): Promise<AuthContext> {
    return Promise.reject(
      new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'AUTH_NOT_CONFIGURED',
        'L’authentification n’est pas configurée.',
      ),
    );
  }
}

export function supabaseIssuer(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/+$/, '')}/auth/v1`;
}

function unauthenticated(message: string): ApiException {
  return new ApiException(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', message);
}
