import { expect, test } from '@playwright/test';
import { expectAccessible } from '../support/a11y';
import { resetBackend, signInAs } from '../support/session';

test.beforeAll(async () => {
  await resetBackend();
});

test('signed-in pages meet WCAG 2.2 AA (no serious violation)', async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  await signInAs(context, 'awa', baseURL!);
  for (const path of [
    '/espace',
    '/espace/equipe',
    '/espace/journal',
    '/espace/parametres',
    '/espace/nouvelle-boutique',
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole('main').getByRole('heading', { level: 1 }),
    ).toBeVisible();
    await expectAccessible(page, path);
  }

  if (isMobile) {
    await page.getByRole('button', { name: 'Plus' }).click();
    await expect(page.getByRole('dialog', { name: 'Plus' })).toBeVisible();
    await expectAccessible(page, 'menu « Plus »');
  }
});
