import { expect, test, type Page } from '@playwright/test';
import { resetBackend, signInAs } from '../support/session';

test.describe.configure({ mode: 'serial' });

const WATER = '/espace/produits/dddddddd-0000-4000-8000-000000000001';

/** 1×1 red PNG: the browser resizes and re-encodes it before upload. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
  'base64',
);

test.beforeAll(async () => {
  await resetBackend();
});

const productList = (page: Page) =>
  page.getByRole('list', { name: 'Produits' });

test('the product list shows prices and what is left', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/produits');
  const water = productList(page).getByRole('link', {
    name: /Eau minérale 1,5 L/,
  });
  await expect(water).toContainText('500 F CFA');
  await expect(water).toContainText('En stock');
  await expect(water).toContainText('24 bouteilles');
  await expect(
    productList(page).getByRole('link', { name: /Savon de Marseille/ }),
  ).toContainText('Épuisé');

  await page
    .getByRole('navigation', { name: 'Filtrer par stock' })
    .getByRole('link', { name: 'Épuisés', exact: true })
    .click();
  await expect(productList(page).getByRole('listitem')).toHaveCount(1);
  await expect(productList(page)).toContainText('Savon de Marseille');

  await page.goto('/espace/produits');
  await page
    .getByLabel('Chercher un produit par nom ou code-barres')
    .fill('eau');
  await page.getByRole('button', { name: 'Chercher' }).click();
  await expect(productList(page).getByRole('listitem')).toHaveCount(1);
  await expect(productList(page)).toContainText('Eau minérale');
});

test('an owner adds a product with its photo and its stock', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/produits');
  await page.getByRole('link', { name: 'Ajouter un produit' }).click();
  await expect(page).toHaveURL(/\/espace\/produits\/nouveau$/);

  // Server-side validation, in French, on the right fields.
  await page.getByRole('button', { name: 'Enregistrer le produit' }).click();
  await expect(page.getByText('Donnez un nom au produit')).toBeVisible();

  await page.getByLabel('Nom du produit').fill('Lait caillé 1 L');
  await page.getByLabel('Prix de vente (F CFA)').fill('1 250');
  await page.getByLabel('Vendu à la').selectOption({ label: 'bouteille' });
  await page
    .getByLabel('Catégorie', { exact: true })
    .selectOption({ label: 'Boissons' });
  await page.getByLabel('Quantité en stock aujourd’hui').fill('12');
  await page.getByLabel('Me prévenir quand il en reste').fill('4');
  await page.locator('input[type=file][name=photo]').setInputFiles({
    name: 'lait.png',
    mimeType: 'image/png',
    buffer: PNG,
  });
  await expect(
    page.getByRole('img', { name: 'Aperçu de la photo' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Enregistrer le produit' }).click();

  await expect(
    page.getByRole('heading', { level: 1, name: 'Lait caillé 1 L' }),
  ).toBeVisible();
  await expect(page.getByText('1 250 F CFA')).toBeVisible();
  const stock = page.getByRole('region', { name: 'Ce qui reste' });
  await expect(stock).toContainText('12 bouteilles');
  await expect(stock).toContainText(
    'Alerte quand il en reste 4 bouteilles ou moins.',
  );
  // The photo went through the web proxy, with the user's session.
  const photo = page.locator('img[src*="/photo?v="]');
  await expect(photo).toBeVisible();
  expect(
    await photo.evaluate((img: HTMLImageElement) => img.naturalWidth),
  ).toBe(1);
});

test('stock moves with deliveries, losses and inventories', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto(WATER);
  const stock = page.getByRole('region', { name: 'Ce qui reste' });

  await page.getByText('J’ai reçu de la marchandise').click();
  await page.getByLabel('Quantité reçue (bouteille)').fill('6');
  await page
    .getByLabel('Fournisseur (facultatif)')
    .selectOption({ label: 'Grossiste Sandaga' });
  await page.getByRole('button', { name: 'Ajouter au stock' }).click();
  await expect(
    page.getByText('Enregistré. Il reste maintenant 30 bouteilles.'),
  ).toBeVisible();
  await expect(stock).toContainText('30 bouteilles');

  await page.getByText('Perte, casse ou produit abîmé').click();
  await page.getByLabel('Quantité perdue (bouteille)').fill('2');
  await page.getByRole('button', { name: 'Retirer du stock' }).click();
  await expect(page.getByText('Indiquez la raison')).toBeVisible();
  // A mistake never erases what was already typed.
  await expect(page.getByLabel('Quantité perdue (bouteille)')).toHaveValue('2');
  await page.getByLabel('Que s’est-il passé ?').fill('Bouteilles percées');
  await page.getByRole('button', { name: 'Retirer du stock' }).click();
  await expect(stock).toContainText('28 bouteilles');

  await page.getByText('J’ai compté ce qui reste (inventaire)').click();
  await page.getByLabel('Quantité comptée (bouteille)').fill('5');
  await page.getByRole('button', { name: 'Corriger le stock' }).click();
  await expect(stock).toContainText('5 bouteilles');
  await expect(stock).toContainText('Bientôt épuisé');

  const history = page.getByRole('list', { name: 'Mouvements du stock' });
  await expect(history.getByRole('listitem')).toHaveCount(4);
  await expect(history.getByRole('listitem').nth(0)).toContainText(
    'Inventaire',
  );
  await expect(history.getByRole('listitem').nth(0)).toContainText(
    '−23 bouteilles',
  );
  await expect(history.getByRole('listitem').nth(1)).toContainText(
    'Bouteilles percées',
  );
  await expect(history.getByRole('listitem').nth(2)).toContainText(
    'Grossiste Sandaga',
  );
  await expect(history.getByRole('listitem').nth(2)).toContainText(
    '+6 bouteilles',
  );
});

test('the home page lists what needs to be bought again', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace');
  const card = page.getByRole('region', { name: 'Stock' });
  await expect(card.getByText('Épuisés', { exact: true })).toBeVisible();
  const alerts = card.getByRole('list', { name: 'Produits à racheter' });
  await expect(alerts.getByRole('listitem').first()).toContainText(
    'Savon de Marseille',
  );
  await expect(alerts).toContainText('Reste 5 bouteilles');
  await alerts.getByRole('link', { name: /Eau minérale/ }).click();
  await expect(page).toHaveURL(new RegExp(`${WATER}$`));
});

test('an owner edits a product and archives it', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/produits?q=Savon');
  await productList(page)
    .getByRole('link', { name: /Savon de Marseille/ })
    .click();
  await page.getByRole('link', { name: 'Modifier' }).click();
  await page.getByLabel('Prix de vente (F CFA)').fill('800');
  await page
    .getByRole('button', { name: 'Enregistrer les modifications' })
    .click();
  await expect(page.getByText('800 F CFA')).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Archiver ce produit' }).click();
  await expect(page.getByText('Ce produit est archivé')).toBeVisible();
  await page.goto('/espace/produits/archives');
  await expect(
    page.getByRole('list', { name: 'Produits archivés' }),
  ).toContainText('Savon de Marseille');
});

test('categories, suppliers and taxes are managed from their lists', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/produits/categories');
  const add = page.getByRole('region', { name: 'Ajouter une catégorie' });
  await add.getByLabel('Nom').fill('Hygiène');
  await add.getByLabel('Couleur').selectOption({ label: 'Rose' });
  await add.getByRole('button', { name: 'Ajouter la catégorie' }).click();
  await expect(add.getByText('Catégorie ajoutée.')).toBeVisible();
  const list = page.getByRole('list', { name: 'Catégories' });
  await expect(list).toContainText('Hygiène');
  await add.getByLabel('Nom').fill('hygiène');
  await add.getByRole('button', { name: 'Ajouter la catégorie' }).click();
  await expect(add.getByText('Une catégorie porte déjà ce nom.')).toBeVisible();
  await list.getByRole('button', { name: 'Archiver Hygiène' }).click();
  await expect(
    list.getByRole('button', { name: 'Réactiver Hygiène' }),
  ).toBeVisible();

  await page.goto('/espace/produits/fournisseurs');
  await expect(
    page.getByRole('link', { name: 'Appeler le 77 000 00 00' }),
  ).toHaveAttribute('href', 'tel:770000000');

  await page.goto('/espace/parametres');
  const tax = page.getByRole('region', { name: 'Ajouter une taxe' });
  await tax.getByLabel('Nom de la taxe').fill('TVA réduite');
  await tax.getByLabel('Taux en %').fill('10');
  await tax.getByRole('button', { name: 'Ajouter la taxe' }).click();
  await expect(page.getByRole('list', { name: 'Taxes' })).toContainText('10 %');
});

test('a seller sees products and stock but cannot change them', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'moussa', baseURL!);
  await page.goto('/espace/produits');
  await expect(productList(page)).toContainText('Eau minérale');
  await expect(
    page.getByRole('link', { name: 'Ajouter un produit' }),
  ).toHaveCount(0);
  await page.goto(WATER);
  await expect(
    page.getByRole('region', { name: 'Ce qui reste' }),
  ).toBeVisible();
  await expect(page.getByText('J’ai reçu de la marchandise')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Modifier' })).toHaveCount(0);
  await page.goto('/espace/produits/nouveau');
  await expect(
    page.getByText(
      'Seuls le propriétaire et les gérants ajoutent des produits.',
    ),
  ).toBeVisible();
  await page.goto('/espace/produits/categories');
  await expect(
    page.getByRole('region', { name: 'Ajouter une catégorie' }),
  ).toHaveCount(0);
});

test('a product of another shop is not found', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  // The page streams (Cache Components), so the status stays 200: what
  // matters is that nothing of the product is shown.
  await page.goto('/espace/produits/eeeeeeee-0000-4000-8000-000000000009');
  await expect(
    page
      .getByRole('main')
      .getByRole('heading', { level: 1, name: 'Introuvable' }),
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Ce qui reste' })).toHaveCount(
    0,
  );
  await resetBackend();
});
