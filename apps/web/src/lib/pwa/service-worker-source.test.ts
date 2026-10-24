import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { OFFLINE_PATH, serviceWorkerSource } from './service-worker-source';

const ORIGIN = 'https://nagaw.test';

type Listener = (event: FakeEvent) => void;
interface FakeEvent {
  request?: { url: string; method: string; mode: string };
  waitUntil(promise: Promise<unknown>): void;
  respondWith(promise: Promise<Response>): void;
}

/**
 * Runs the generated worker against in-memory caches and a scripted
 * network, the way a browser would drive it.
 */
function boot(
  version: string,
  network: (url: string) => Response | Error,
  caches = new Map<string, Map<string, Response>>(),
) {
  const listeners = new Map<string, Listener>();
  const fetched: string[] = [];
  const keyOf = (input: string | { url: string }) =>
    new URL(typeof input === 'string' ? input : input.url, ORIGIN).href;

  const cacheApi = (store: Map<string, Response>) => ({
    match: async (req: string | { url: string }) =>
      store.get(keyOf(req))?.clone(),
    put: async (req: string | { url: string }, res: Response) => {
      store.set(keyOf(req), res);
    },
    addAll: async (urls: string[]) => {
      for (const url of urls) {
        const res = await fakeFetch(url);
        if (!res.ok) throw new Error(`addAll: ${url} ${res.status}`);
        store.set(keyOf(url), res);
      }
    },
  });

  async function fakeFetch(input: string | { url: string }) {
    const url = keyOf(input);
    fetched.push(new URL(url).pathname);
    const result = network(new URL(url).pathname);
    if (result instanceof Error) throw result;
    return result;
  }

  const self = {
    location: { origin: ORIGIN },
    skipWaiting: async () => undefined,
    clients: { claim: async () => undefined },
    addEventListener: (type: string, listener: Listener) =>
      listeners.set(type, listener),
  };
  runInNewContext(serviceWorkerSource(version), {
    self,
    fetch: fakeFetch,
    URL,
    Response,
    caches: {
      open: async (name: string) => {
        if (!caches.has(name)) caches.set(name, new Map());
        return cacheApi(caches.get(name)!);
      },
      keys: async () => [...caches.keys()],
      delete: async (name: string) => caches.delete(name),
      match: async (req: string) => {
        for (const store of caches.values()) {
          const hit = store.get(keyOf(req));
          if (hit) return hit.clone();
        }
        return undefined;
      },
    },
  });

  async function dispatch(type: string, request?: FakeEvent['request']) {
    let waited: Promise<unknown> | undefined;
    let responded: Promise<Response> | undefined;
    listeners.get(type)!({
      request,
      waitUntil: (p) => (waited = p),
      respondWith: (p) => (responded = p),
    });
    await waited;
    return responded;
  }
  const get = (path: string, mode = 'no-cors') =>
    dispatch('fetch', { url: ORIGIN + path, method: 'GET', mode });

  return { caches, fetched, dispatch, get };
}

const OFFLINE_HTML =
  '<html><link rel="stylesheet" href="/_next/static/css/app.css">' +
  '<script src="/_next/static/chunks/main.js"></script>' +
  '<script>self.__next_f.push([1,"\\"/_next/static/chunks/page.js\\""])</script></html>';

const CAISSE_HTML =
  '<html><script src="/_next/static/chunks/caisse.js"></script></html>';

function site(path: string): Response | Error {
  if (path === OFFLINE_PATH) return new Response(OFFLINE_HTML);
  if (path === '/caisse') return new Response(CAISSE_HTML);
  if (path.startsWith('/_next/static/')) return new Response(`asset ${path}`);
  return new Response(`page ${path}`);
}

describe('service worker', () => {
  it('caches the offline pages and every static asset they reference', async () => {
    const sw = boot('v1', site);
    await sw.dispatch('install');
    const cache = sw.caches.get('nagaw-shell-v1')!;
    expect(
      [...cache.keys()].map((url) => new URL(url).pathname).sort(),
    ).toEqual([
      '/_next/static/chunks/caisse.js',
      '/_next/static/chunks/main.js',
      '/_next/static/chunks/page.js',
      '/_next/static/css/app.css',
      '/caisse',
      OFFLINE_PATH,
    ]);
  });

  it('fails the install when an asset is missing, keeping the previous worker', async () => {
    const sw = boot('v1', (path) =>
      path === '/_next/static/chunks/main.js'
        ? new Response('gone', { status: 404 })
        : site(path),
    );
    await expect(sw.dispatch('install')).rejects.toThrow(/main\.js/);
  });

  it('serves the offline page when a navigation fails, and the network otherwise', async () => {
    let online = true;
    const sw = boot('v1', (path) =>
      online ? site(path) : new TypeError('Failed to fetch'),
    );
    await sw.dispatch('install');

    expect(await (await sw.get('/espace', 'navigate'))!.text()).toBe(
      'page /espace',
    );
    online = false;
    expect(await (await sw.get('/espace', 'navigate'))!.text()).toBe(
      OFFLINE_HTML,
    );
    // The offline checkout opens from its own cached copy.
    expect(await (await sw.get('/caisse', 'navigate'))!.text()).toBe(
      CAISSE_HTML,
    );
  });

  it('serves cached static assets without the network', async () => {
    let online = true;
    const sw = boot('v1', (path) =>
      online ? site(path) : new TypeError('Failed to fetch'),
    );
    await sw.dispatch('install');
    online = false;
    expect(await (await sw.get('/_next/static/chunks/main.js'))!.text()).toBe(
      'asset /_next/static/chunks/main.js',
    );
  });

  it('never intercepts API calls, Server Actions or other origins', async () => {
    const sw = boot('v1', site);
    expect(await sw.get('/api/v1/me')).toBeUndefined();
    expect(
      await sw.dispatch('fetch', {
        url: `${ORIGIN}/espace`,
        method: 'POST',
        mode: 'navigate',
      }),
    ).toBeUndefined();
    expect(
      await sw.dispatch('fetch', {
        url: 'https://api.nagaw.test/api/v1/me',
        method: 'GET',
        mode: 'cors',
      }),
    ).toBeUndefined();
  });

  it('drops the caches of previous versions on activation', async () => {
    const caches = new Map([
      ['nagaw-shell-v1', new Map<string, Response>()],
      ['other-app', new Map<string, Response>()],
    ]);
    const sw = boot('v2', site, caches);
    await sw.dispatch('install');
    await sw.dispatch('activate');
    expect([...caches.keys()].sort()).toEqual(['nagaw-shell-v2', 'other-app']);
  });
});
