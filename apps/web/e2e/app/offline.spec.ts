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

const banner = (page: Page) =>
  page.getByRole('status').filter({ hasText: /connexion|attente d’envoi/ });

test('online, a sale from the checkout is sent at once and numbered', async ({
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
    /Ticket n° \d{6} \([A-Z]-\d{6}\)/,
  );
});

test('offline, sales are kept on the phone and sent when the network returns', async ({
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
  await expect(page.getByText('Vente enregistrée.')).toBeVisible();
  await expect(page.getByText(/Gardée sur ce téléphone/)).toBeVisible();
  await expect(page.getByText(/À rendre : 500/)).toBeVisible();
  const label = await page.getByRole('heading', { level: 1 }).textContent();
  expect(label).toMatch(/^Ticket [A-Z]-\d{6}$/);
  await expect(banner(page)).toContainText('1 vente gardée sur ce téléphone');

  // The checkout reopens without network, from the phone.
  await page.reload();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Vendre' }),
  ).toBeVisible();
  await expect(page.getByText(/Données de ce téléphone du/)).toBeVisible();

  await context.setOffline(false);
  await expect(banner(page)).toHaveCount(0, { timeout: 15_000 });

  await page.goto('/espace/ventes');
  const ticket = label!.replace('Ticket ', '');
  await expect(
    page.getByRole('list', { name: 'Liste des ventes' }),
  ).toContainText(`(${ticket})`);
});

test('a customer created offline buys on credit, both sent together', async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  test.skip(isMobile, 'Covered once');
  await signInAs(context, 'awa', baseURL!);
  await openCheckoutOnline(page);
  await context.setOffline(true);
  await addToCart(page, 'Eau minérale 1,5 L', 2);
  await openPayment(page, isMobile);
  await page.getByRole('button', { name: 'À crédit', exact: true }).click();
  await page.getByRole('button', { name: 'Nouveau client' }).click();
  await page.getByLabel('Nom du nouveau client').fill('Ndèye Fall');
  await page.getByRole('button', { name: 'Ajouter le client' }).click();
  await page.getByRole('button', { name: /^Valider la vente/ }).click();
  await expect(page.getByText(/Gardée sur ce téléphone/)).toBeVisible();

  await context.setOffline(false);
  await expect(banner(page)).toHaveCount(0, { timeout: 15_000 });
  await page.goto('/espace/clients?doivent=1');
  await expect(
    page.getByRole('list', { name: 'Liste des clients' }),
  ).toContainText('Ndèye Fall');
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
