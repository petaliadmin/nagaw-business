import { describe, expect, it } from 'vitest';
import { callApi } from './call-api';

function stub(
  handler: (url: URL, init: RequestInit) => Response | Promise<Response>,
) {
  const calls: { url: URL; init: RequestInit }[] = [];
  const fetchImpl = (async (url: URL, init: RequestInit) => {
    calls.push({ url, init });
    return handler(url, init);
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe('callApi', () => {
  it('sends the bearer token, tenant header and JSON body', async () => {
    const { fetchImpl, calls } = stub(() =>
      Response.json({ id: 'o1' }, { status: 201 }),
    );
    const result = await callApi({
      baseUrl: 'https://api.test',
      token: 'tok',
      method: 'POST',
      path: '/organizations',
      body: { name: 'Acme' },
      organizationId: 'org-1',
      fetchImpl,
    });
    expect(result).toEqual({ ok: true, status: 201, data: { id: 'o1' } });
    expect(calls[0]?.url.toString()).toBe(
      'https://api.test/api/v1/organizations',
    );
    expect(calls[0]?.init.headers).toMatchObject({
      Authorization: 'Bearer tok',
      'X-Organization-Id': 'org-1',
      'Content-Type': 'application/json',
    });
    expect(calls[0]?.init.body).toBe('{"name":"Acme"}');
  });

  it('adds the Vercel protection bypass header only when configured', async () => {
    const { fetchImpl, calls } = stub(() => Response.json({}));
    await callApi({
      baseUrl: 'https://api.test',
      token: 't',
      path: '/me',
      fetchImpl,
    });
    expect(calls[0]?.init.headers).not.toHaveProperty(
      'x-vercel-protection-bypass',
    );
    await callApi({
      baseUrl: 'https://api.test',
      token: 't',
      path: '/me',
      protectionBypass: 'secret',
      fetchImpl,
    });
    expect(calls[1]?.init.headers).toMatchObject({
      'x-vercel-protection-bypass': 'secret',
    });
  });

  it('keeps well-formed field details and drops the rest', async () => {
    const { fetchImpl } = stub(() =>
      Response.json(
        {
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Configuration invalide.',
            details: [
              { path: 'maxSteps', message: 'Au plus 5 étapes.' },
              'not a detail',
              { path: 3, message: 'bad path' },
            ],
          },
        },
        { status: 400 },
      ),
    );
    const result = await callApi({
      baseUrl: 'https://api.test',
      token: 't',
      path: '/agents',
      fetchImpl,
    });
    expect(result).toMatchObject({
      ok: false,
      code: 'VALIDATION_FAILED',
      details: [{ path: 'maxSteps', message: 'Au plus 5 étapes.' }],
    });
  });

  it('surfaces the documented error envelope', async () => {
    const { fetchImpl } = stub(() =>
      Response.json(
        {
          error: {
            code: 'ORGANIZATION_NOT_FOUND',
            message: 'Organisation introuvable.',
          },
        },
        { status: 404 },
      ),
    );
    const result = await callApi({
      baseUrl: 'https://api.test',
      token: 't',
      path: '/x',
      fetchImpl,
    });
    expect(result).toEqual({
      ok: false,
      status: 404,
      code: 'ORGANIZATION_NOT_FOUND',
      message: 'Organisation introuvable.',
    });
  });

  it('handles missing configuration, network failures and non-JSON bodies', async () => {
    expect(
      (await callApi({ baseUrl: undefined, token: 't', path: '/x' })).ok,
    ).toBe(false);

    const down = stub(() => {
      throw new Error('ECONNREFUSED');
    });
    const unreachable = await callApi({
      baseUrl: 'https://api.test',
      token: 't',
      path: '/x',
      fetchImpl: down.fetchImpl,
    });
    expect(unreachable).toMatchObject({ ok: false, code: 'API_UNREACHABLE' });

    const html = stub(() => new Response('<html></html>', { status: 200 }));
    const invalid = await callApi({
      baseUrl: 'https://api.test',
      token: 't',
      path: '/x',
      fetchImpl: html.fetchImpl,
    });
    expect(invalid).toMatchObject({ ok: false, code: 'API_INVALID_RESPONSE' });
  });
});
