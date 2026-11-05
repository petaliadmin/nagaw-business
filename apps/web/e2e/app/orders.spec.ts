import { expect, test } from '@playwright/test';
import { expectAccessible } from '../support/a11y';
import { resetBackend, signInAs } from '../support/session';

test.describe.configure({ mode: 'serial' });

const SLUG = 'acme-dakar-1a2b3c';

test.beforeAll(async () => {
  await resetBackend();
});

test('the shop opens its catalogue, a customer orders, the shop delivers', async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  // 1. The owner shows « Commandes », then publishes the catalogue.
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/parametres');
  const menu = page.getByRole('region', { name: 'Menu de la boutique' });
  await menu.locator('label', { hasText: 'Commandes' }).click();
  await menu.getByRole('button', { name: 'Enregistrer le menu' }).click();
  await expect(menu.getByText('Menu enregistré.')).toBeVisible();

  await page.goto('/espace/commandes');
  await page.getByRole('link', { name: 'Mon catalogue en ligne' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Catalogue en ligne' }),
  ).toBeVisible();
  const catalog = page.getByRole('main');
  await catalog.getByLabel('Mettre mon catalogue en ligne').check();
  await catalog.getByLabel('Mon numéro Wave').fill('76 000 00 00');
  await catalog
    .getByRole('button', { name: 'Enregistrer le catalogue' })
    .click();
  await expect(
    catalog.getByText('Catalogue en ligne : partagez le lien.'),
  ).toBeVisible();
  await expect(
    catalog.getByRole('link', { name: new RegExp(`/b/${SLUG}$`) }),
  ).toBeVisible();

  // 2. A customer, without account, opens the link and orders.
  const visitor = await browser.newContext({ baseURL });
  const shop = await visitor.newPage();
  await shop.goto(`/b/${SLUG}`);
  await expect(
    shop.getByRole('heading', { level: 1, name: 'Acme Dakar' }),
  ).toBeVisible();
  await expectAccessible(shop, 'catalogue public');
  await shop
    .getByRole('button', { name: 'Ajouter Eau minérale 1,5 L' })
    .click();
  await shop
    .getByRole('button', { name: 'Ajouter un Eau minérale 1,5 L' })
    .click();
  await shop.getByRole('button', { name: 'Commander' }).click();
  const sheet = shop.getByRole('dialog', { name: 'Votre commande' });
  await expect(sheet.getByText('2 × Eau minérale 1,5 L')).toBeVisible();
  await sheet.getByLabel('Votre nom').fill('Fatou Ndiaye');
  await sheet.getByLabel('Votre téléphone').fill('77 111 22 33');
  await sheet.getByLabel('Quartier ou adresse de livraison').fill('Médina');
  await sheet.getByRole('button', { name: 'Envoyer la commande' }).click();
  await expect(
    shop.getByRole('heading', { name: 'Commande envoyée' }),
  ).toBeVisible();
  await expect(shop.getByText(/^CMD-[0-9A-Z]{6}$/).first()).toBeVisible();
  await expect(shop.getByText('76 000 00 00')).toBeVisible();
  await visitor.close();

  // 3. The shop handles it, up to the delivery.
  await page.goto('/espace/commandes');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Commandes' }),
  ).toBeVisible();
  await expectAccessible(page, 'commandes');
  await page.getByRole('link', { name: /Fatou Ndiaye · Médina/ }).click();
  await page.getByRole('button', { name: 'Confirmer la commande' }).click();
  // The next step replaces the form: the courier.
  await page.getByLabel('Nom du livreur').fill('Moussa');
  await page.getByLabel('Téléphone du livreur').fill('78 000 11 22');
  await page.getByRole('button', { name: 'Envoyer en livraison' }).click();
  await expect(
    page.getByRole('link', { name: 'Message au livreur' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Relancer sur WhatsApp' }),
  ).toBeVisible();
  await expectAccessible(page, 'commande en livraison');
  await page.locator('label', { hasText: 'Espèces' }).click();
  await page.getByRole('button', { name: 'Marquer livrée' }).click();
  await expect(page.getByRole('link', { name: 'Voir la vente' })).toBeVisible();
  await resetBackend();
});

test('a shop that has not published has no public page', async ({ page }) => {
  // The page streams: the « not found » screen comes inside it.
  await page.goto(`/b/${SLUG}`);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Page introuvable' }),
  ).toBeVisible();
});
