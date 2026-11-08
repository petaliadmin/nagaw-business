import { expect, test } from '@playwright/test';
import { expectAccessible } from '../support/a11y';
import { resetBackend, signInAs } from '../support/session';

test.beforeAll(async () => {
  await resetBackend();
});

test('« Vider le panier » asks first, then empties the cart', async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/caisse');
  const products = page.getByRole('list', { name: 'Produits à vendre' });
  const water = products.getByRole('button', {
    name: /^Ajouter Eau minérale 1,5 L/,
  });
  await water.click();
  await water.click();
  if (isMobile) await page.getByRole('button', { name: /^Encaisser/ }).click();
  const cart = page.getByRole('list', { name: 'Articles du panier' });
  await expect(cart.getByRole('listitem')).toHaveCount(1);

  // The app's own window, not the browser's: refused, nothing changes.
  const ask = page.getByRole('alertdialog', { name: 'Vider le panier ?' });
  await page.getByRole('button', { name: 'Vider le panier' }).click();
  await expect(ask).toBeVisible();
  await expect(ask).toContainText('Tous les articles et la remise');
  // « Annuler » has the focus: a hurried tap never empties the cart.
  await expect(ask.getByRole('button', { name: 'Annuler' })).toBeFocused();
  await expectAccessible(page, 'confirmation');
  await ask.getByRole('button', { name: 'Annuler' }).click();
  await expect(ask).toBeHidden();
  await expect(cart.getByRole('listitem')).toHaveCount(1);

  // Escape cancels too.
  await page.getByRole('button', { name: 'Vider le panier' }).click();
  await page.keyboard.press('Escape');
  await expect(ask).toBeHidden();
  await expect(cart.getByRole('listitem')).toHaveCount(1);

  await page.getByRole('button', { name: 'Vider le panier' }).click();
  await ask.getByRole('button', { name: 'Vider le panier' }).click();
  await expect(cart).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Vider le panier' }),
  ).toHaveCount(0);
  // On a phone, back to the products: nothing is left to pay.
  if (isMobile) await expect(products).toBeVisible();
  await expect(page.getByRole('button', { name: /^Encaisser/ })).toHaveCount(0);
});

test('the checkout keeps the seller: sales inside, out only on purpose', async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/caisse');
  // No link leads out of the checkout.
  await expect(page.getByRole('main').getByRole('link')).toHaveCount(0);
  await expect(page.getByRole('banner').getByRole('link')).toHaveCount(0);

  const products = page.getByRole('list', { name: 'Produits à vendre' });
  await products
    .getByRole('button', { name: /^Ajouter Eau minérale 1,5 L/ })
    .click();

  // The sales of the phone, then back: the cart is still there.
  await page.getByRole('button', { name: /^Ventes \(/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Ventes de ce téléphone' }),
  ).toBeVisible();
  await expect(products).toBeHidden();
  await page.getByRole('button', { name: 'Vendre', exact: true }).click();
  if (isMobile) await page.getByRole('button', { name: /^Encaisser/ }).click();
  await expect(
    page
      .getByRole('list', { name: 'Articles du panier' })
      .getByRole('listitem'),
  ).toHaveCount(1);

  // Leaving asks first; « Annuler » stays in the checkout.
  const ask = page.getByRole('alertdialog', { name: 'Quitter la caisse ?' });
  await page.getByRole('button', { name: /^Quitter/ }).click();
  await ask.getByRole('button', { name: 'Annuler' }).click();
  await expect(page).toHaveURL(/\/caisse$/);
  await page.getByRole('button', { name: /^Quitter/ }).click();
  await ask.getByRole('button', { name: 'Quitter la caisse' }).click();
  await expect(page).toHaveURL(/\/espace$/);
});

test('a shop that sells both picks products or services in one tap', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/caisse');
  const products = page.getByRole('list', { name: 'Produits à vendre' });
  await products.waitFor();
  // Products only so far: no choice to make.
  await expect(
    page.getByRole('group', { name: 'Produits ou services' }),
  ).toHaveCount(0);

  await page.goto('/espace/produits/nouveau');
  await page.waitForLoadState('networkidle');
  await page.locator('label', { hasText: 'Un service' }).click();
  await page.getByLabel('Nom du service').fill('Livraison à domicile');
  await page.getByLabel(/^Prix de vente/).fill('1000');
  await page.getByRole('button', { name: 'Enregistrer le service' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Livraison à domicile' }),
  ).toBeVisible();

  await page.goto('/caisse');
  const kinds = page.getByRole('group', { name: 'Produits ou services' });
  await expect(kinds).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Produits et services' }),
  ).toBeVisible();
  await kinds.getByRole('button', { name: 'Services' }).click();
  await expect(products).toContainText('Livraison à domicile');
  await expect(products).not.toContainText('Eau minérale');
  await kinds.getByRole('button', { name: 'Produits' }).click();
  await expect(products).toContainText('Eau minérale');
  await expect(products).not.toContainText('Livraison à domicile');
  await kinds.getByRole('button', { name: 'Tout' }).click();
  await expect(products).toContainText('Livraison à domicile');
  await expect(products).toContainText('Eau minérale');
});
