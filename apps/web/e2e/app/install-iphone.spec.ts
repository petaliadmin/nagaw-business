import { expect, test } from '@playwright/test';
import { expectAccessible } from '../support/a11y';
import { resetBackend, signInAs } from '../support/session';

/**
 * Installing on an iPhone, which has no installation event: the steps of
 * its browser, and Safari for the apps' own browsers.
 */
test.beforeAll(async () => {
  await resetBackend();
});

const IPHONE = {
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
};

test.describe('Safari 26', () => {
  test.use({
    ...IPHONE,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
  });

  test('shows « … », Partager, Sur l’écran d’accueil, then stays in the menu', async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, 'awa', baseURL!);
    await page.goto('/espace');
    const sheet = page.getByRole('dialog', {
      name: 'Installer Nagaw Business',
    });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText(/Touchez « … »/)).toBeVisible();
    await expect(sheet.getByText('Ouvrir comme app web')).toBeVisible();
    await expect(sheet.getByText(/connectez-vous une fois/)).toBeVisible();
    await expectAccessible(page, 'installation iPhone');
    await sheet.getByRole('button', { name: 'J’ai compris' }).click();
    await expect(sheet).toBeHidden();
    // The steps are one touch away in the menu.
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('button', { name: 'Installer l’application' }).click();
    await expect(
      page.getByRole('dialog', { name: 'Installer Nagaw Business' }).last(),
    ).toBeVisible();
  });
});

test.describe('Instagram', () => {
  test.use({
    ...IPHONE,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0',
  });

  test('sends to Safari, with the address to copy', async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, 'awa', baseURL!);
    await page.goto('/espace');
    const sheet = page.getByRole('dialog', {
      name: 'Installer Nagaw Business',
    });
    await expect(sheet.getByText(/Ouvrir dans Safari/)).toBeVisible();
    await expect(sheet.getByText(/\/espace$/)).toBeVisible();
    await expect(
      sheet.getByRole('button', { name: 'Copier l’adresse' }),
    ).toBeVisible();
  });
});
