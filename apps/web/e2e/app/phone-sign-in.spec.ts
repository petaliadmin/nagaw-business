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
