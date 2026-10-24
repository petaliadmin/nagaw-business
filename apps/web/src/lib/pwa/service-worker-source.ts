/** Page served by the service worker when a navigation fails offline. */
export const OFFLINE_PATH = '/hors-ligne';

/**
 * Source of `/sw.js` (ADR-020, Phase 8 scope). It caches only what holds no
 * user data: the offline page, its assets and the hashed, immutable files
 * under `/_next/static/`. Pages and API responses are never cached here;
 * offline data (catalogue, pending sales) arrives in Phase 11, in IndexedDB.
 *
 * - install: caches the offline page and every static asset it references
 *   (atomic: one failure aborts the install, the previous worker stays);
 * - activate: deletes the caches of previous versions;
 * - fetch: cache first for `/_next/static/`, network first for page
 *   navigations with the offline page as fallback; everything else
 *   (API, Server Actions, RSC requests) goes straight to the network.
 */
export function serviceWorkerSource(version: string): string {
  return String.raw`'use strict';
const CACHE = 'nagaw-shell-' + ${JSON.stringify(version)};
const OFFLINE_URL = ${JSON.stringify(OFFLINE_PATH)};
const STATIC_PREFIX = '/_next/static/';

function referencedAssets(html) {
  const found = html.match(/\/_next\/static\/[^"'\s()<>\\]+/g) || [];
  return Array.from(new Set(found));
}

async function precache() {
  const response = await fetch(OFFLINE_URL, { cache: 'reload' });
  if (!response.ok) {
    throw new Error('Page hors ligne indisponible (HTTP ' + response.status + ')');
  }
  const html = await response.clone().text();
  const cache = await caches.open(CACHE);
  await cache.addAll(referencedAssets(html));
  await cache.put(OFFLINE_URL, response);
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
    const offline = await caches.match(OFFLINE_URL);
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
`;
}
