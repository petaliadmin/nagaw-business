/** Page served by the service worker when a navigation fails offline. */
export const OFFLINE_PATH = '/hors-ligne';

/**
 * Static pages kept for offline use: they hold no user data (the checkout
 * reads its data from the device's IndexedDB, ADR-020).
 */
export const OFFLINE_PAGES = [OFFLINE_PATH, '/caisse'] as const;

/**
 * Source of `/sw.js` (ADR-020). It caches only what holds no user data: the
 * static offline pages (OFFLINE_PAGES), their assets and the hashed,
 * immutable files under `/_next/static/`. Signed-in pages and API responses
 * are never cached here; offline data lives in IndexedDB.
 *
 * - install: caches the offline pages and every static asset they reference
 *   (atomic: one failure aborts the install, the previous worker stays);
 * - activate: deletes the caches of previous versions;
 * - fetch: cache first for `/_next/static/`, network first for page
 *   navigations, then the cached copy of that page, then the offline page;
 *   everything else (API, Server Actions, RSC requests) goes straight to
 *   the network.
 */
export function serviceWorkerSource(version: string): string {
  return String.raw`'use strict';
const CACHE = 'nagaw-shell-' + ${JSON.stringify(version)};
const OFFLINE_URL = ${JSON.stringify(OFFLINE_PATH)};
const PAGES = ${JSON.stringify(OFFLINE_PAGES)};
const STATIC_PREFIX = '/_next/static/';

function referencedAssets(html) {
  const found = html.match(/\/_next\/static\/[^"'\s()<>\\]+/g) || [];
  return Array.from(new Set(found));
}

async function precache() {
  const cache = await caches.open(CACHE);
  for (const page of PAGES) {
    const response = await fetch(page, { cache: 'reload' });
    if (!response.ok) {
      throw new Error('Page ' + page + ' indisponible (HTTP ' + response.status + ')');
    }
    const html = await response.clone().text();
    await cache.addAll(referencedAssets(html));
    await cache.put(page, response);
  }
}

async function removeOldCaches() {
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((key) => key.startsWith('nagaw-') && key !== CACHE)
      .map((key) => caches.delete(key)),
  );
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

async function networkOrOfflinePage(request) {
  try {
    return await fetch(request);
  } catch (error) {
    const page = new URL(request.url).pathname;
    const kept = PAGES.includes(page) ? await caches.match(page) : undefined;
    const offline = kept || (await caches.match(OFFLINE_URL));
    if (offline) return offline;
    throw error;
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(removeOldCaches().then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith(STATIC_PREFIX)) {
    event.respondWith(cacheFirst(request));
  } else if (request.mode === 'navigate') {
    event.respondWith(networkOrOfflinePage(request));
  }
});

// Push messages (ADR-036): the server sends { title, body, tag, url }. A
// message of the same tag replaces the previous one on the phone.
function samePageOfApp(url) {
  return typeof url === 'string' && /^\/(espace|caisse)(\/|\?|$)/.test(url) && !url.includes('//')
    ? url
    : '/espace/notifications';
}

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = typeof data.title === 'string' && data.title ? data.title : 'Nagaw Business';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === 'string' ? data.body : '',
      tag: typeof data.tag === 'string' ? data.tag : undefined,
      renotify: true,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: samePageOfApp(data.url) },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(samePageOfApp(event.notification.data && event.notification.data.url), self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (client.url === target && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
`;
}
