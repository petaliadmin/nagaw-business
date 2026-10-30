import { expect, test } from '@playwright/test';
import { addLargeSale, resetBackend, signInAs } from '../support/session';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
  'base64',
);

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await resetBackend();
  await addLargeSale(25);
});

test.afterAll(async () => {
  await resetBackend();
});

test('all the sales are listed, page by page', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/ventes');
  await page.getByRole('link', { name: 'Toutes', exact: true }).click();
  await expect(page).toHaveURL(/vue=toutes/);
  await expect(page.getByRole('region', { name: 'Aujourd’hui' })).toHaveCount(
    0,
  );
  const list = page.getByRole('list', { name: 'Liste des ventes' });
  await expect(list.getByRole('listitem')).toHaveCount(20);

  const pages = page.getByRole('navigation', { name: 'Pages de la liste' });
  await pages.getByRole('link', { name: 'Suivant' }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page).toHaveURL(/vue=toutes/);
  await expect(list.getByRole('listitem')).toHaveCount(5);
  await expect(pages.getByRole('link', { name: 'Suivant' })).toHaveCount(0);
  await pages.getByRole('link', { name: 'Précédent' }).click();
  await expect(list.getByRole('listitem')).toHaveCount(20);
});

test('a short list has no page buttons', async ({ page, context, baseURL }) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/produits');
  await expect(
    page.getByRole('list', { name: 'Produits' }).getByRole('listitem').first(),
  ).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Pages de la liste' }),
  ).toHaveCount(0);
});

test('a shop of services only sees what serves it, and can change', async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/parametres');
  await page.waitForLoadState('networkidle');
  const shop = page.getByRole('region', { name: 'Boutique' });
  await shop.locator('label', { hasText: 'Des services' }).click();
  await shop.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(shop.getByText('Paramètres enregistrés.')).toBeVisible();

  await page.goto('/espace/produits');
  const main = page.getByRole('main');
  await expect(
    main.getByRole('heading', { level: 1, name: 'Services' }),
  ).toBeVisible();
  await expect(main.getByRole('link', { name: 'Fournisseurs' })).toHaveCount(0);
  await expect(main.getByRole('link', { name: 'Unités' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Filtrer' }).click();
  const sheet = page.getByRole('dialog', { name: 'Filtrer les produits' });
  await expect(sheet.getByText('Stock', { exact: true })).toHaveCount(0);
  await expect(sheet.getByText('Type', { exact: true })).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Fermer' }).click();

  await main.getByRole('link', { name: 'Ajouter un service' }).click();
  await expect(page.getByLabel('Nom du service')).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Un produit' })).toHaveCount(0);

  await page.goto('/espace');
  await expect(page.getByRole('region', { name: 'Stock' })).toHaveCount(0);
  if (!isMobile)
    await expect(
      page
        .getByRole('navigation', { name: 'Navigation principale' })
        .getByRole('link', { name: 'Fournisseurs' }),
    ).toHaveCount(0);
});

test('an owner gives the shop a logo, then removes it', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/parametres');
  // The field reads the file once the page is interactive.
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Choisir un logo').setInputFiles({
    name: 'logo.png',
    mimeType: 'image/png',
    buffer: PNG,
  });
  await expect(page.getByRole('img', { name: 'Aperçu du logo' })).toBeVisible();
  await page.getByRole('button', { name: 'Valider le logo' }).click();
  await expect(page.getByText('Logo enregistré.')).toBeVisible();

  await page.reload();
  const logo = page.getByRole('img', { name: 'Aperçu du logo' });
  await expect(logo).toHaveAttribute('src', /^\/espace\/logo\?v=/);
  expect(
    await logo.evaluate(
      (img: HTMLImageElement) => img.complete && img.naturalWidth,
    ),
  ).toBeGreaterThan(0);

  await page.getByLabel('Retirer le logo').check();
  await page.getByRole('button', { name: 'Valider le logo' }).click();
  await expect(page.getByLabel('Choisir un logo')).toBeVisible();
});

test('an owner chooses the colour of the documents', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/parametres');
  const invoices = page.getByRole('region', { name: 'Factures et devis' });
  await invoices.getByRole('button', { name: 'Bleu' }).click();
  await expect(invoices.getByRole('button', { name: 'Bleu' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await invoices.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(invoices.getByText('Paramètres enregistrés.')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Bleu' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
