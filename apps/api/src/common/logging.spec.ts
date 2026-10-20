import { serializeRequest, serializeResponse } from './logging.js';

describe('HTTP log serializers', () => {
  it('keeps only id, method and path — never headers or query strings', () => {
    const serialized = serializeRequest({
      id: 'r1',
      method: 'GET',
      url: '/api/v1/health/ready?_vercel_share=secret-share-token',
      // Extra fields present on the real serialized request:
      ...({
        headers: {
          authorization: 'Bearer user-jwt',
          'x-vercel-oidc-token': 'platform-token',
          cookie: 'sb-access-token=abc',
        },
        query: { _vercel_share: 'secret-share-token' },
      } as object),
    });
    expect(serialized).toEqual({
      id: 'r1',
      method: 'GET',
      path: '/api/v1/health/ready',
    });
    expect(JSON.stringify(serialized)).not.toMatch(/token|jwt|secret/);
  });

  it('keeps only the status code of responses', () => {
    expect(
      serializeResponse({
        statusCode: 200,
        ...({ headers: { 'set-cookie': 'x' } } as object),
      }),
    ).toEqual({ statusCode: 200 });
  });
});
