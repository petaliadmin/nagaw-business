import { expect, test } from '@playwright/test';
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

  // Refused: nothing changes.
  page.once('dialog', (dialog) => void dialog.dismiss());
  await page.getByRole('button', { name: 'Vider le panier' }).click();
  await expect(cart.getByRole('listitem')).toHaveCount(1);

  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: 'Vider le panier' }).click();
  await expect(cart).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Vider le panier' }),
  ).toHaveCount(0);
  // On a phone, back to the products: nothing is left to pay.
  if (isMobile) await expect(products).toBeVisible();
  await expect(page.getByRole('button', { name: /^Encaisser/ })).toHaveCount(0);
});
