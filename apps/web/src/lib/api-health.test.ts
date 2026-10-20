import { describe, expect, it } from 'vitest';
import { fetchApiHealth } from './api-health';

const healthy = {
  status: 'ok',
  service: 'nagaw-api',
  version: 'dev',
  environment: 'local',
  time: '2026-10-20T10:00:00.000Z',
};

function stubFetch(impl: () => Promise<Response>): typeof fetch {
  return (() => impl()) as unknown as typeof fetch;
}

describe('fetchApiHealth', () => {
  it('reports not_configured when no API URL is set', async () => {
    expect(await fetchApiHealth(undefined)).toEqual({
      state: 'not_configured',
    });
  });

  it('returns up with validated data', async () => {
    const result = await fetchApiHealth(
      'http://api.test',
      stubFetch(async () => Response.json(healthy)),
    );
    expect(result).toEqual({ state: 'up', data: healthy });
  });

  it('returns down on non-2xx status', async () => {
    const result = await fetchApiHealth(
      'http://api.test',
      stubFetch(async () => new Response('x', { status: 503 })),
    );
    expect(result).toEqual({ state: 'down', reason: 'HTTP 503' });
  });

  it('returns down when the payload does not match the contract', async () => {
    const result = await fetchApiHealth(
      'http://api.test',
      stubFetch(async () => Response.json({ status: 'ok' })),
    );
    expect(result.state).toBe('down');
  });

  it('returns down when a 2xx response is not JSON (e.g. a login page)', async () => {
    const result = await fetchApiHealth(
      'http://api.test',
      stubFetch(
        async () =>
          new Response('<!DOCTYPE html><html></html>', {
            status: 200,
            headers: { 'content-type': 'text/html' },
          }),
      ),
    );
    expect(result).toEqual({
      state: 'down',
      reason: 'Réponse non JSON (protection d’accès ou mauvaise URL ?)',
    });
  });

  it('returns down when the network call fails', async () => {
    const result = await fetchApiHealth(
      'http://api.test',
      stubFetch(async () => {
        throw new Error('ECONNREFUSED');
      }),
    );
    expect(result).toEqual({
      state: 'down',
      reason: 'API injoignable (ECONNREFUSED)',
    });
  });
});
