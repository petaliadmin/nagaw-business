import { randomUUID } from 'node:crypto';
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type JWTPayload,
} from 'jose';
import { SupabaseJwtVerifier } from '../../src/auth/jwt-verifier.js';

export const TEST_ISSUER = 'https://test-project.supabase.co/auth/v1';

/**
 * Real ES256 key pair standing in for a Supabase project: tokens are signed
 * and verified exactly as in production, only the JWKS is local.
 */
export async function createTestAuth() {
  const kid = randomUUID();
  const { privateKey, publicKey } = await generateKeyPair('ES256');
  const publicJwk = { ...(await exportJWK(publicKey)), kid, alg: 'ES256' };
  const verifier = new SupabaseJwtVerifier(
    createLocalJWKSet({ keys: [publicJwk] }),
    TEST_ISSUER,
  );

  async function sign(
    userId: string,
    overrides: JWTPayload & { expiresIn?: string } = {},
  ): Promise<string> {
    const { expiresIn = '5m', ...claims } = overrides;
    return new SignJWT({ role: 'authenticated', ...claims })
      .setProtectedHeader({ alg: 'ES256', kid })
      .setSubject(userId)
      .setIssuer(TEST_ISSUER)
      .setAudience('authenticated')
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(privateKey);
  }

  return { verifier, sign, privateKey, kid };
}
