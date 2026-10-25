#!/usr/bin/env node
// Smoke test of a deployment (Phase 18), read only: health of the API,
// closed routes, pages and security headers of the site, and no secret in
// the JavaScript the browser downloads. Run after each production deploy:
//   pnpm smoke https://nagaw-web.vercel.app https://nagaw-api-petalia.vercel.app
import { findSecrets } from './check-client-bundle.mjs';

const [webUrl, apiUrl] = process.argv.slice(2);
if (!webUrl || !apiUrl) {
  console.error('Usage : pnpm smoke <URL du site> <URL de l’API>');
  process.exit(2);
}

const results = [];
async function check(name, run) {
  try {
    await run();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({
      name,
      ok: false,
      why: error instanceof Error ? error.message : String(error),
    });
  }
}
function expect(condition, message) {
  if (!condition) throw new Error(message);
}
const get = (url, init) =>
  fetch(url, {
    redirect: 'manual',
    ...init,
    signal: AbortSignal.timeout(15_000),
  });

await check('API : vivante', async () => {
  const res = await get(`${apiUrl}/api/v1/health`);
  expect(res.status === 200, `statut ${res.status}`);
});
await check('API : prête (base et authentification)', async () => {
  const res = await get(`${apiUrl}/api/v1/health/ready`);
  const body = await res.json();
  expect(
    res.status === 200 && body.status === 'ready',
    `statut ${res.status} ${JSON.stringify(body)}`,
  );
});
await check('API : routes fermées sans session', async () => {
  for (const path of [
    '/api/v1/me',
    '/api/v1/sales',
    '/api/v1/admin/overview',
    '/api/v1/accounting/journal',
  ]) {
    const res = await get(`${apiUrl}${path}`);
    const body = await res.json().catch(() => ({}));
    expect(
      res.status === 401 && body.error?.code === 'UNAUTHENTICATED',
      `${path} : ${res.status}`,
    );
  }
});
await check('API : pas de documentation en production', async () => {
  const res = await get(`${apiUrl}/api/v1/docs`);
  expect(res.status === 404 || res.status === 401, `statut ${res.status}`);
});

const HEADERS = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'strict-transport-security': 'max-age=',
  'content-security-policy': "frame-ancestors 'none'",
};
let loginHtml = '';
for (const path of ['/connexion', '/inscription', '/hors-ligne', '/caisse']) {
  await check(`Site : ${path} et ses en-têtes`, async () => {
    const res = await get(`${webUrl}${path}`);
    expect(res.status === 200, `statut ${res.status}`);
    for (const [name, value] of Object.entries(HEADERS))
      expect(
        (res.headers.get(name) ?? '').includes(value),
        `en-tête ${name} absent ou différent`,
      );
    const html = await res.text();
    expect(
      findSecrets(html).length === 0,
      `secret dans la page : ${findSecrets(html).join(', ')}`,
    );
    if (path === '/connexion') loginHtml = html;
  });
}
await check(
  'Site : application installable (manifeste, service worker)',
  async () => {
    const manifest = await get(`${webUrl}/manifest.webmanifest`);
    expect(manifest.status === 200, `manifeste : ${manifest.status}`);
    const sw = await get(`${webUrl}/sw.js`);
    expect(
      sw.status === 200 &&
        (sw.headers.get('content-type') ?? '').includes('javascript'),
      `sw.js : ${sw.status}`,
    );
  },
);
await check('Site : aucun secret dans le JavaScript téléchargé', async () => {
  const scripts = [...loginHtml.matchAll(/<script[^>]+src="([^"]+)"/g)].map(
    (m) => new URL(m[1], webUrl).href,
  );
  expect(scripts.length > 0, 'aucun script trouvé dans /connexion');
  for (const src of scripts) {
    const text = await (await get(src)).text();
    const found = findSecrets(text);
    expect(found.length === 0, `${src} : ${found.join(', ')}`);
  }
});

for (const r of results)
  console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.ok ? '' : ` — ${r.why}`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(
  failed
    ? `\n${failed} vérification(s) en échec.`
    : `\n${results.length} vérifications réussies.`,
);
process.exit(failed ? 1 : 0);
