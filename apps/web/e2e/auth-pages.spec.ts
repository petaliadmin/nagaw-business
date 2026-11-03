import { expect, test } from '@playwright/test';

test('home page links to sign-up and sign-in', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Sachez qui vous doit et ce que vous gagnez, depuis votre téléphone',
    }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Créer ma boutique' }).first().click();
  await expect(page).toHaveURL(/\/inscription$/);
  await expect(
    page.getByRole('heading', { name: 'Créer un compte' }),
  ).toBeVisible();
});

test('sign-up asks for a phone number and a secret code, checked on the server', async ({
  page,
}) => {
  await page.goto('/inscription');
  await expect(page.getByLabel('Pays')).toHaveValue('SN');
  await expect(page.getByLabel('Pays')).toContainText('Sénégal (+221)');
  await page.getByLabel('Numéro de téléphone').fill('77 12');
  await page.getByLabel('Choisissez un code secret (4 chiffres)').fill('4826');
  await page.getByLabel('Retapez le code secret').fill('4826');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();

  await expect(page.getByRole('main').getByRole('alert')).toHaveText(
    'Vérifiez les champs indiqués.',
  );
  await expect(
    page.getByText('Numéro de téléphone invalide pour ce pays'),
  ).toBeVisible();
  await expect(page.getByLabel('Numéro de téléphone')).toHaveAttribute(
    'aria-invalid',
    'true',
  );

  await page.getByLabel('Numéro de téléphone').fill('77 123 45 67');
  await page.getByLabel('Choisissez un code secret (4 chiffres)').fill('1234');
  await page.getByLabel('Retapez le code secret').fill('1234');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(
    page.getByText(
      'Ce code est trop facile à deviner. Choisissez-en un autre.',
    ),
  ).toBeVisible();
});

test('a valid sign-up says plainly that authentication is not configured', async ({
  page,
}) => {
  await page.goto('/inscription');
  await page.getByLabel('Numéro de téléphone').fill('77 123 45 67');
  await page.getByLabel('Choisissez un code secret (4 chiffres)').fill('4826');
  await page.getByLabel('Retapez le code secret').fill('4826');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText(
    'L’authentification n’est pas encore configurée sur cet environnement.',
  );
});

test('sign-in uses the phone number; a forgotten code goes through the team', async ({
  page,
}) => {
  await page.goto('/connexion');
  await expect(page.getByLabel('Pays')).toHaveValue('SN');
  await expect(page.getByLabel('Code secret (4 chiffres)')).toHaveAttribute(
    'inputmode',
    'numeric',
  );
  await page.getByRole('link', { name: 'Code secret oublié ?' }).click();
  await expect(
    page.getByRole('heading', { name: 'Code secret oublié' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Appeler le +221 76 905 58 52' }),
  ).toHaveAttribute('href', 'tel:+221769055852');
});

test('an older account still signs in with its e-mail and can reset its password', async ({
  page,
}) => {
  await page.goto('/connexion');
  await page
    .getByRole('link', {
      name: 'J’ai un ancien compte avec une adresse e-mail',
    })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Ancien compte' }),
  ).toBeVisible();
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
