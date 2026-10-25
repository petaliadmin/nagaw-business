import { expect, test } from '@playwright/test';

// Headers of every page (Phase 17), checked on a page and on a route.
for (const path of ['/connexion', '/espace', '/caisse']) {
  test(`${path} is served with the security headers`, async ({ request }) => {
    const response = await request.get(path, { maxRedirects: 0 });
    const headers = response.headers();
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['strict-transport-security']).toContain('max-age=');
    expect(headers['permissions-policy']).toContain('microphone=()');
    expect(headers['content-security-policy']).toContain(
      "frame-ancestors 'none'",
    );
  });
}

test('the service worker keeps its own strict policy', async ({ request }) => {
  const response = await request.get('/sw.js');
  expect(response.headers()['content-security-policy']).toContain(
    "script-src 'self'",
  );
  expect(response.headers()['x-frame-options']).toBe('DENY');
});
