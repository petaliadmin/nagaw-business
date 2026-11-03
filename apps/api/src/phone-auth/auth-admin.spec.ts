import { GoTrueAuthAdmin } from './auth-admin.js';

const URL_ = 'https://project.supabase.co';

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = ((url: URL, init: RequestInit) => {
    calls.push({ url: url.toString(), init });
    return Promise.resolve(
      new Response(body === undefined ? '' : JSON.stringify(body), { status }),
    );
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe('GoTrueAuthAdmin', () => {
  it('creates a confirmed phone account with the secret key', async () => {
    const { impl, calls } = fakeFetch(200, { id: 'user-1' });
    const admin = new GoTrueAuthAdmin(URL_, 'sb_secret_abcdefghijklmnop', impl);
    await expect(admin.createUser('221771234567', 'Ng1-x')).resolves.toBe(
      'user-1',
    );
    expect(calls[0]!.url).toBe(`${URL_}/auth/v1/admin/users`);
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
      phone: '221771234567',
      password: 'Ng1-x',
      phone_confirm: true,
    });
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers.apikey).toBe('sb_secret_abcdefghijklmnop');
    // A `sb_secret_` key is not a JWT: never sent as a bearer token.
    expect(headers.Authorization).toBeUndefined();
  });

  it('sends a legacy service_role key as a bearer token too', async () => {
    const { impl, calls } = fakeFetch(200, { id: 'user-1' });
    const key = 'eyJhbGciOiJIUzI1NiJ9.service.role';
    await new GoTrueAuthAdmin(URL_, key, impl).createUser('221771234567', 'p');
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${key}`);
  });

  it('reads whether the Phone provider is on', async () => {
    const on = fakeFetch(200, { external: { phone: true, email: true } });
    await expect(
      new GoTrueAuthAdmin(
        URL_,
        'sb_secret_abcdefghijklmnop',
        on.impl,
      ).phoneEnabled(),
    ).resolves.toBe(true);
    expect(on.calls[0]!.url).toBe(`${URL_}/auth/v1/settings`);
    expect(on.calls[0]!.init.body).toBeUndefined();
    const off = fakeFetch(200, { external: { phone: false } });
    await expect(
      new GoTrueAuthAdmin(
        URL_,
        'sb_secret_abcdefghijklmnop',
        off.impl,
      ).phoneEnabled(),
    ).resolves.toBe(false);
  });

  it('reports a number already used', async () => {
    const { impl } = fakeFetch(422, { error_code: 'phone_exists' });
    const admin = new GoTrueAuthAdmin(URL_, 'sb_secret_abcdefghijklmnop', impl);
    await expect(admin.createUser('221771234567', 'p')).resolves.toBe(
      'phone_taken',
    );
    await expect(
      admin.updateUser('user-1', { phone: '221771234567', password: 'p' }),
    ).resolves.toBe('phone_taken');
  });

  it('opens a session, or says the password is wrong', async () => {
    const ok = fakeFetch(200, { access_token: 'a', refresh_token: 'r' });
    await expect(
      new GoTrueAuthAdmin(URL_, 'sb_secret_abcdefghijklmnop', ok.impl).signIn(
        '221771234567',
        'p',
      ),
    ).resolves.toEqual({ accessToken: 'a', refreshToken: 'r' });
    expect(ok.calls[0]!.url).toBe(`${URL_}/auth/v1/token?grant_type=password`);

    const wrong = fakeFetch(400, { error_code: 'invalid_credentials' });
    await expect(
      new GoTrueAuthAdmin(
        URL_,
        'sb_secret_abcdefghijklmnop',
        wrong.impl,
      ).signIn('221771234567', 'p'),
    ).resolves.toBeNull();
  });

  it('answers 503 when Supabase refuses or cannot be reached', async () => {
    const limited = fakeFetch(429, { error_code: 'over_request_rate_limit' });
    await expect(
      new GoTrueAuthAdmin(
        URL_,
        'sb_secret_abcdefghijklmnop',
        limited.impl,
      ).signIn('221771234567', 'p'),
    ).rejects.toMatchObject({ code: 'AUTH_UNAVAILABLE', status: 503 });

    const unreachable = (() =>
      Promise.reject(new Error('ECONNRESET'))) as unknown as typeof fetch;
    await expect(
      new GoTrueAuthAdmin(
        URL_,
        'sb_secret_abcdefghijklmnop',
        unreachable,
      ).createUser('221771234567', 'p'),
    ).rejects.toMatchObject({ code: 'AUTH_UNAVAILABLE' });
  });
});
