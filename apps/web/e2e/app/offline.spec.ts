import { expect, test, type Page } from '@playwright/test';
import { resetBackend, signInAs } from '../support/session';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await resetBackend();
});

async function addToCart(page: Page, name: string, times = 1) {
  const tile = page
    .getByRole('list', { name: 'Produits à vendre' })
    .getByRole('button', { name: new RegExp(`^Ajouter ${name}`) });
  for (let i = 0; i < times; i++) await tile.click();
}

async function openPayment(page: Page, isMobile: boolean) {
  if (isMobile) await page.getByRole('button', { name: /^Encaisser/ }).click();
  await expect(page.getByRole('heading', { name: 'Paiement' })).toBeVisible();
}

/** The checkout opened once online: device registered, data on the phone. */
async function openCheckoutOnline(page: Page) {
  await page.goto('/caisse');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Vendre' }),
  ).toBeVisible();
  await page.waitForFunction(
    () => navigator.serviceWorker?.controller !== null,
  );
}

test('online, a sale from the checkout is recorded by the server at once', async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await openCheckoutOnline(page);
  await addToCart(page, 'Eau minérale 1,5 L', 2);
  await openPayment(page, isMobile);
  await page.getByRole('button', { name: /^Valider la vente/ }).click();
  await expect(page).toHaveURL(/\/espace\/ventes\/[^/?]+\?nouvelle=1$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    /Ticket n° \d{6}/,
  );
});

// ADR-042: the checkout sells online only; a sale without network is
// never shown as done, and sent again it is recorded once.
test('without network, the sale is refused at once, then recorded once when sent again', async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await openCheckoutOnline(page);

  await context.setOffline(true);
  await addToCart(page, 'Eau minérale 1,5 L');
  await openPayment(page, isMobile);
  await page.getByLabel('Somme reçue du client (facultatif)').fill('1000');
  await page.getByRole('button', { name: /^Valider la vente/ }).click();
  await expect(
    page.getByText(/Pas de connexion internet : rien n’est enregistré/),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/caisse$/);

  await context.setOffline(false);
  await page.getByRole('button', { name: /^Valider la vente/ }).click();
  await expect(page).toHaveURL(/\/espace\/ventes\/[^/?]+\?nouvelle=1$/);
  await expect(page.getByText(/À rendre/)).toContainText('500');
});

test('the checkout does not open without network, and says why', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await openCheckoutOnline(page);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByText(/La caisse a besoin d’internet pour enregistrer les ventes/),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Vendre' }),
  ).toHaveCount(0);

  // Back online, it opens by itself.
  await context.setOffline(false);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Vendre' }),
  ).toBeVisible({ timeout: 20_000 });
});

test('signing out erases what the phone keeps', async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await openCheckoutOnline(page);
  await page.goto('/espace');
  if (isMobile) await page.getByRole('button', { name: 'Plus' }).click();
  await page.getByRole('button', { name: 'Se déconnecter' }).first().click();
  await expect(page).toHaveURL(/\/connexion$/);
  const databases = await page.evaluate(async () =>
    (await indexedDB.databases()).map((db) => db.name),
  );
  expect(databases).not.toContain('nagaw');
  await resetBackend();
});
