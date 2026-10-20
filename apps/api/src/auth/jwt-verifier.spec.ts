import { randomUUID } from 'node:crypto';
import { generateKeyPair, SignJWT } from 'jose';
import { createTestAuth, TEST_ISSUER } from '../../test/support/jwt.js';
import { ApiException } from '../common/api-exception.js';
import { UnconfiguredJwtVerifier } from './jwt-verifier.js';

async function expectCode(promise: Promise<unknown>, code: string) {
  const error = await promise.then(
    () => undefined,
    (err: unknown) => err,
  );
  expect(error).toBeInstanceOf(ApiException);
  expect((error as ApiException).code).toBe(code);
}

describe('SupabaseJwtVerifier', () => {
  const userId = randomUUID();

  it('accepts a valid token and returns the user', async () => {
    const auth = await createTestAuth();
    const token = await auth.sign(userId, { email: 'a@example.test' });
    await expect(auth.verifier.verify(token)).resolves.toEqual({
      userId,
      email: 'a@example.test',
    });
  });

  it('rejects an expired token', async () => {
    const auth = await createTestAuth();
    const token = await auth.sign(userId, { expiresIn: '-1m' });
    await expectCode(auth.verifier.verify(token), 'UNAUTHENTICATED');
  });

  it('rejects a token signed by another key', async () => {
    const auth = await createTestAuth();
    const other = await generateKeyPair('ES256');
    const forged = await new SignJWT({ role: 'authenticated' })
      .setProtectedHeader({ alg: 'ES256', kid: auth.kid })
      .setSubject(userId)
      .setIssuer(TEST_ISSUER)
      .setAudience('authenticated')
      .setExpirationTime('5m')
      .sign(other.privateKey);
    await expectCode(auth.verifier.verify(forged), 'UNAUTHENTICATED');
  });

  it('rejects wrong issuer, wrong audience and anonymous users', async () => {
    const auth = await createTestAuth();
    const wrongIssuer = await new SignJWT({ role: 'authenticated' })
      .setProtectedHeader({ alg: 'ES256', kid: auth.kid })
      .setSubject(userId)
      .setIssuer('https://evil.example/auth/v1')
      .setAudience('authenticated')
      .setExpirationTime('5m')
      .sign(auth.privateKey);
    await expectCode(auth.verifier.verify(wrongIssuer), 'UNAUTHENTICATED');

    const anonymous = await auth.sign(userId, { is_anonymous: true });
    await expectCode(auth.verifier.verify(anonymous), 'UNAUTHENTICATED');

    const serviceRole = await auth.sign(userId, { role: 'service_role' });
    await expectCode(auth.verifier.verify(serviceRole), 'UNAUTHENTICATED');
  });

  it('rejects a subject that is not a UUID', async () => {
    const auth = await createTestAuth();
    const token = await auth.sign('not-a-uuid');
    await expectCode(auth.verifier.verify(token), 'UNAUTHENTICATED');
  });

  it('rejects garbage', async () => {
    const auth = await createTestAuth();
    await expectCode(auth.verifier.verify('abc.def.ghi'), 'UNAUTHENTICATED');
  });
});

describe('UnconfiguredJwtVerifier', () => {
  it('answers AUTH_NOT_CONFIGURED', async () => {
    await expectCode(
      new UnconfiguredJwtVerifier().verify(),
      'AUTH_NOT_CONFIGURED',
    );
  });
});
