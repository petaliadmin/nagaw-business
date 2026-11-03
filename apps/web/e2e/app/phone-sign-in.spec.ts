import { expect, test } from '@playwright/test';
import { resetBackend } from '../support/session';

test.beforeAll(async () => {
  await resetBackend();
});

// Binta's account in the fake backend: +221 77 000 00 03, code 2580.
test('signs in with a phone number and a secret code (ADR-058)', async ({
  page,
}) => {
  await page.goto('/connexion');
  await page.getByLabel('Numéro de téléphone').fill('77 000 00 03');
  await page.getByLabel('Code secret (4 chiffres)').fill('1357');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Numéro ou code secret incorrect.',
  );
  // What was typed stays: only the code needs typing again.
  await expect(page.getByLabel('Numéro de téléphone')).toHaveValue(
    '77 000 00 03',
  );

  await page.getByLabel('Code secret (4 chiffres)').fill('2580');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/espace/);
});

test('a number already signed in on this device only asks for the code (ADR-059)', async ({
  page,
  context,
}) => {
  await page.goto('/connexion');
  await page.getByLabel('Numéro de téléphone').fill('77 000 00 03');
  await page.getByLabel('Code secret (4 chiffres)').fill('2580');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/espace/);

  // The session ends; the device keeps the number.
  await context.clearCookies({ name: /^sb-/ });
  await page.goto('/connexion');
  const main = page.getByRole('main');
  await expect(main).toContainText('+221 77 000 00 03');
  await expect(page.getByLabel('Numéro de téléphone')).toHaveCount(0);

  const pad = page.getByRole('group', { name: 'Code secret (4 chiffres)' });
  // A wrong code is sent at the fourth digit, then cleared.
  for (const digit of '1357') {
    await pad.getByRole('button', { name: digit, exact: true }).click();
  }
  await expect(main.getByRole('alert')).toContainText(
    'Numéro ou code secret incorrect.',
  );
  await expect(pad.getByRole('status')).toHaveText('0 chiffre(s) sur 4');

  // A computer keyboard types too.
  await page.keyboard.type('9');
  await pad.getByRole('button', { name: 'Effacer' }).click();
  await page.keyboard.type('2580');
  await expect(page).toHaveURL(/\/espace/);
});

test('"Ce n’est pas mon numéro" brings back the full form', async ({
  page,
  context,
}) => {
  await page.goto('/connexion');
  await page.getByLabel('Numéro de téléphone').fill('77 000 00 03');
  await page.getByLabel('Code secret (4 chiffres)').fill('2580');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/espace/);

  await context.clearCookies({ name: /^sb-/ });
  await page.goto('/connexion');
  await page.getByRole('button', { name: 'Ce n’est pas mon numéro' }).click();
  await expect(page.getByLabel('Numéro de téléphone')).toHaveValue('');
  await page.reload();
  await expect(page.getByLabel('Numéro de téléphone')).toBeVisible();
});
