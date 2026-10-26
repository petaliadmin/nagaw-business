import { expect, test, type Page } from '@playwright/test';
import { expectAccessible } from '../support/a11y';
import { resetBackend, signInAs } from '../support/session';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await resetBackend();
});

// A 1 × 1 PNG, as a photo of a receipt.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function sellWater(page: Page, isMobile: boolean) {
  await page.goto('/espace/vendre');
  await page
    .getByRole('list', { name: 'Produits à vendre' })
    .getByRole('button', { name: /^Ajouter Eau minérale 1,5 L/ })
    .click();
  if (isMobile) await page.getByRole('button', { name: /^Encaisser/ }).click();
  await page.getByRole('button', { name: /^Valider la vente/ }).click();
  await expect(page.getByText('Vente enregistrée.')).toBeVisible();
}

test('the journal books the day’s sale and expense, and exports them', async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await sellWater(page, isMobile);
  await page.goto('/espace/tresorerie/depenses');
  await page.locator('summary', { hasText: 'Ajouter une dépense' }).click();
  await page.getByLabel('Ce qui a été payé').fill('Sacs plastiques');
  await page.getByLabel('Montant', { exact: true }).fill('150');
  await page
    .getByLabel('Catégorie', { exact: true })
    .selectOption({ label: 'Autres dépenses' });
  await page.getByRole('button', { name: 'Enregistrer la dépense' }).click();
  await expect(page.getByText('Dépense enregistrée.')).toBeVisible();
  const year = new Date().getFullYear();
  await expect(
    page.getByRole('list', { name: 'Liste des dépenses' }),
  ).toContainText(`DEP-${year}-0001`);

  await page.goto('/espace/comptabilite');
  const journal = page.getByRole('list', {
    name: 'Journal des recettes et dépenses',
  });
  await expect(journal).toContainText('Vente au comptoir');
  await expect(journal).toContainText('compte 70');
  await expect(journal).toContainText(`DEP-${year}-0001 · compte 658`);
  await expectAccessible(page, 'journal');

  const csv = await page.request.get(
    (await page
      .getByRole('link', { name: 'Télécharger le journal (CSV)' })
      .getAttribute('href'))!,
  );
  expect(csv.headers()['content-type']).toBe('text/csv; charset=utf-8');
  expect(csv.headers()['content-disposition']).toMatch(
    /^attachment; filename="journal-recettes-depenses-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.csv"$/,
  );
  expect(await csv.text()).toContain(`DEP-${year}-0001`);
});

test('the end of year statement gives the result', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/comptabilite');
  await page.getByRole('link', { name: 'État de fin d’exercice' }).click();
  const result = page.getByRole('region', { name: /^Résultat \d{4}$/ });
  await expect(result).toBeVisible();
  await expect(result.getByRole('table', { name: 'Recettes' })).toContainText(
    '70 Ventes',
  );
  await expect(result.getByRole('table', { name: 'Dépenses' })).toContainText(
    '658',
  );
  await expect(page.getByText(/chiffres provisoires/)).toBeVisible();
  await expectAccessible(page, 'état de fin d’exercice');
  const csv = await page.request.get(
    (await page
      .getByRole('link', { name: 'Télécharger l’état (CSV)' })
      .getAttribute('href'))!,
  );
  expect(csv.status()).toBe(200);
  expect(await csv.text()).toContain('Total des recettes');
});

test('a receipt photo is kept with its expense', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/tresorerie/depenses');
  await page.getByText('Ajouter le justificatif (photo)').click();
  await page
    .getByLabel('Prendre ou choisir une photo')
    .setInputFiles({ name: 'recu.png', mimeType: 'image/png', buffer: PNG });
  await expect(
    page.getByRole('img', { name: 'Aperçu de la photo' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Enregistrer le justificatif' })
    .click();
  const link = page.getByRole('link', {
    name: /^Voir le justificatif de DEP-/,
  });
  await expect(link).toBeVisible();
  const image = await page.request.get((await link.getAttribute('href'))!);
  expect(image.status()).toBe(200);
  expect(image.headers()['content-type']).toMatch(/^image\//);
});

test('a seller has no access to the accounts', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'moussa', baseURL!);
  await page.goto('/espace');
  await expect(page.getByRole('link', { name: 'Comptabilité' })).toHaveCount(0);
  await page.goto('/espace/comptabilite');
  await expect(
    page.getByText(
      'Votre rôle ne donne pas accès à la comptabilité de la boutique.',
    ),
  ).toBeVisible();
  const csv = await page.request.get('/espace/comptabilite/export/journal');
  expect(csv.status()).toBe(403);
});
