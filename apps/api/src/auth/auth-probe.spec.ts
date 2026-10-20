import { JwksAuthProbe } from './auth-probe.js';

const URL = 'https://p.supabase.co/auth/v1/.well-known/jwks.json';

function fetchReturning(response: Response | Error): typeof fetch {
  return (async () => {
    if (response instanceof Error) throw response;
    return response;
  }) as unknown as typeof fetch;
}

describe('JwksAuthProbe', () => {
  it('is ok when the project publishes signing keys', async () => {
    const probe = new JwksAuthProbe(
      URL,
      fetchReturning(Response.json({ keys: [{ kty: 'EC' }] })),
    );
    await expect(probe.check()).resolves.toBe('ok');
  });

  it('flags a legacy HS256 project (empty JWKS)', async () => {
    const probe = new JwksAuthProbe(
      URL,
      fetchReturning(Response.json({ keys: [] })),
    );
    await expect(probe.check()).resolves.toBe('no_signing_keys');
  });

  it('reports missing configuration and network failures', async () => {
    await expect(new JwksAuthProbe(undefined).check()).resolves.toBe(
      'not_configured',
    );
    await expect(
      new JwksAuthProbe(URL, fetchReturning(new Error('ENOTFOUND'))).check(),
    ).resolves.toBe('unreachable');
    await expect(
      new JwksAuthProbe(
        URL,
        fetchReturning(new Response('nope', { status: 500 })),
      ).check(),
    ).resolves.toBe('unreachable');
  });
});
