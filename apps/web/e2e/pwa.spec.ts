import { expect, test } from '@playwright/test';
import { expectAccessible } from './support/a11y';

test('the app is installable: manifest and icons', async ({ request }) => {
  const response = await request.get('/manifest.webmanifest');
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest).toMatchObject({
    name: 'Nagaw Business',
    lang: 'fr',
    start_url: '/espace',
    display: 'standalone',
  });
  const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
  for (const icon of manifest.icons as { src: string }[]) {
    expect((await request.get(icon.src)).ok(), icon.src).toBe(true);
  }
});

test('the service worker is served uncached, as JavaScript', async ({
  request,
}) => {
  const response = await request.get('/sw.js');
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toContain(
    'application/javascript',
  );
  expect(response.headers()['cache-control']).toContain('no-store');
  expect(await response.text()).toContain("'nagaw-shell-'");
});

test('offline, a page that cannot load shows the offline page', async ({
  page,
  context,
}) => {
  await page.goto('/');
  // Wait until the worker controls the page (it claims clients on activate).
  await page.waitForFunction(
    () => navigator.serviceWorker?.controller !== null,
  );

  await context.setOffline(true);
  await page.goto('/connexion');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Pas de connexion' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Réessayer' })).toBeVisible();
  // The connection banner says it too.
  await expect(
    page.getByRole('status').filter({ hasText: 'Pas de connexion internet' }),
  ).toBeVisible();

  await context.setOffline(false);
  await page.getByRole('button', { name: 'Réessayer' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Connexion' }),
  ).toBeVisible();
});

test('the connection banner appears and disappears with the network', async ({
  page,
  context,
}) => {
  await page.goto('/connexion');
  const banner = page
    .getByRole('status')
    .filter({ hasText: 'Pas de connexion internet' });
  await expect(banner).toHaveCount(0);
  await context.setOffline(true);
  await expect(banner).toBeVisible();
  await context.setOffline(false);
  await expect(banner).toHaveCount(0);
});

test('public pages meet WCAG 2.2 AA (no serious violation)', async ({
  page,
}) => {
  for (const path of [
    '/',
    '/connexion',
    '/inscription',
    '/mot-de-passe-oublie',
    '/hors-ligne',
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectAccessible(page, path);
  }
});
