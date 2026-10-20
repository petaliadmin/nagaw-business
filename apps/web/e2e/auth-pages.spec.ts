import { expect, test } from '@playwright/test';

test('home page links to sign-up and sign-in', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Nagaw Business' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Créer un compte' }).click();
  await expect(page).toHaveURL(/\/inscription$/);
  await expect(
    page.getByRole('heading', { name: 'Créer un compte' }),
  ).toBeVisible();
});

test('sign-up validates input on the server and reports errors in French', async ({
  page,
}) => {
  await page.goto('/inscription');
  await page.getByLabel('Adresse e-mail').fill('pas-un-email');
  await page.getByLabel('Mot de passe (8 caractères minimum)').fill('court');
  await page.getByLabel('Confirmation du mot de passe').fill('different');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();

  await expect(page.getByRole('main').getByRole('alert')).toHaveText(
    'Vérifiez les champs indiqués.',
  );
  await expect(page.getByText('Adresse e-mail invalide')).toBeVisible();
  await expect(
    page.getByText('Le mot de passe doit contenir au moins 8 caractères'),
  ).toBeVisible();
  await expect(page.getByLabel('Adresse e-mail')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
});

test('a valid sign-up says plainly that authentication is not configured', async ({
  page,
}) => {
  await page.goto('/inscription');
  await page.getByLabel('Adresse e-mail').fill('awa@example.sn');
  await page
    .getByLabel('Mot de passe (8 caractères minimum)')
    .fill('motdepasse-solide');
  await page
    .getByLabel('Confirmation du mot de passe')
    .fill('motdepasse-solide');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText(
    'L’authentification n’est pas encore configurée sur cet environnement.',
  );
});

test('sign-in page links to password recovery', async ({ page }) => {
  await page.goto('/connexion');
  await page.getByRole('link', { name: 'Mot de passe oublié ?' }).click();
  await expect(
    page.getByRole('heading', { name: 'Mot de passe oublié' }),
  ).toBeVisible();
  await page.getByLabel('Adresse e-mail').fill('invalide');
  await page.getByRole('button', { name: 'Recevoir un lien' }).click();
  await expect(page.getByText('Adresse e-mail invalide')).toBeVisible();
});

test('workspace states that authentication is not configured', async ({
  page,
}) => {
  await page.goto('/espace');
  await expect(page.getByRole('main').getByRole('alert')).toHaveText(
    'L’authentification n’est pas encore configurée sur cet environnement.',
  );
});

test('auth callback without a code lands on the invalid-link page', async ({
  page,
}) => {
  await page.goto('/auth/callback?next=https://evil.example');
  await expect(page).toHaveURL(/\/lien-invalide$/);
  await expect(
    page.getByRole('heading', { name: 'Ce lien n’a pas pu ouvrir de session' }),
  ).toBeVisible();
});
