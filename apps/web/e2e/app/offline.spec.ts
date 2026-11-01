import { expect, test, type Page } from '@playwright/test';
import { resetBackend, signInAs } from '../support/session';

test.describe.configure({ mode: 'serial' });

test.beforeEach(async () => {
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
  // The registration of the device is over: nothing is left to the network.
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(localStorage).some((k) => k.startsWith('nagaw:device-op')),
      ),
    )
    .toBe(true);
}

async function sellOffline(page: Page, isMobile: boolean) {
  await addToCart(page, 'Eau minérale 1,5 L');
  await openPayment(page, isMobile);
  await page.getByRole('button', { name: /^Valider la vente/ }).click();
  await expect(page.getByText(/Gardée sur ce téléphone/)).toBeVisible();
}

const nextSale = (page: Page) =>
  page.getByRole('button', { name: 'Nouvelle vente' }).click();

const banner = (page: Page) =>
  page
    .getByRole('status')
    .filter({ hasText: /connexion|attente d’envoi|serveur|gardée/ });

/** Sends the phone's queue now, without waiting for the 30 s timer. */
const wakeUp = (page: Page) =>
  page.evaluate(() => window.dispatchEvent(new Event('online')));

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

  // The checkout reopens without network, from the phone, with its sales.
  // A clear message comes first, and says that selling still works.
  await page.reload();
  const notice = page.getByRole('dialog', { name: 'Vous êtes hors ligne' });
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('Vous pouvez quand même vendre');
  await expect(notice).toContainText('partiront toutes seules');
  await notice.getByRole('button', { name: 'Commencer à vendre' }).click();
  await expect(notice).toHaveCount(0);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Vendre' }),
  ).toBeVisible();
  await expect(page.getByText(/Données de ce téléphone du/)).toBeVisible();
  await page.getByText(/Ventes de ce téléphone \(1\)/).click();
  await expect(
    page.getByRole('list', { name: 'Ventes de ce téléphone' }),
  ).toContainText('En attente');

  await context.setOffline(false);
  await expect(banner(page)).toHaveCount(0, { timeout: 15_000 });
  await expect(
    page.getByRole('list', { name: 'Ventes de ce téléphone' }),
  ).toContainText('Envoyée');

  await page.goto('/espace/ventes');
  const ticket = label!.replace('Ticket ', '');
  await expect(
    page.getByRole('list', { name: 'Liste des ventes' }),
  ).toContainText(`(${ticket})`);
});

test('the message never interrupts a sale, and leaves when the network returns', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await openCheckoutOnline(page);
  const notice = page.getByRole('dialog', { name: 'Vous êtes hors ligne' });

  // The network drops at the counter: the banner is enough.
  await context.setOffline(true);
  await addToCart(page, 'Eau minérale 1,5 L');
  await expect(banner(page)).toBeVisible();
  await expect(notice).toHaveCount(0);

  // Opened without network, then the network comes back.
  await page.reload();
  await expect(notice).toBeVisible();
  await context.setOffline(false);
  await expect(notice).toHaveCount(0, { timeout: 15_000 });
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

// ADR-053: the phone is the reference, not the account.
test('another member of the shop delivers what the phone keeps, the seller stays', async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  // Awa sells offline, then Moussa signs in on the same phone.
  await signInAs(context, 'awa', baseURL!);
  await openCheckoutOnline(page);
  await context.setOffline(true);
  await sellOffline(page, isMobile);
  const label = await page.getByRole('heading', { level: 1 }).textContent();

  await signInAs(context, 'moussa', baseURL!);
  await context.setOffline(false);
  await page.goto('/caisse');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Vendre' }),
  ).toBeVisible();
  await expect(banner(page)).toHaveCount(0, { timeout: 15_000 });

  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/ventes?vue=toutes');
  const ticket = label!.replace('Ticket ', '');
  const list = page.getByRole('list', { name: 'Liste des ventes' });
  await expect(list).toContainText(`(${ticket})`);
  await list.getByRole('link', { name: new RegExp(ticket) }).click();
  await expect(page.getByText(/Vendu par awa@acme.test/)).toBeVisible();
});

test('signing out keeps everything, closes the checkout, and the sales still leave', async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await openCheckoutOnline(page);
  await page.route('**/caisse/synchroniser', (route) => route.abort());
  await sellOffline(page, isMobile);

  await page.goto('/espace');
  if (isMobile) await page.getByRole('button', { name: 'Plus' }).click();
  await page.getByRole('button', { name: 'Se déconnecter' }).first().click();
  await expect(page).toHaveURL(/\/connexion$/);
  const databases = await page.evaluate(async () =>
    (await indexedDB.databases()).map((db) => db.name),
  );
  expect(databases).toContain('nagaw');

  // Without a session, nobody sells from what the phone keeps.
  await page.goto('/caisse');
  await expect(
    page.getByText(/Connectez-vous pour ouvrir la caisse/),
  ).toBeVisible();

  await page.unroute('**/caisse/synchroniser');
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/caisse');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Vendre' }),
  ).toBeVisible();
  await page.getByText(/Ventes de ce téléphone \(1\)/).click();
  await expect(
    page.getByRole('list', { name: 'Ventes de ce téléphone' }),
  ).toContainText('Envoyée', { timeout: 15_000 });
});

test('a session that expired leaves the checkout open, and says what to do', async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await openCheckoutOnline(page);
  await context.clearCookies();
  await page.reload();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Vendre' }),
  ).toBeVisible();
  await sellOffline(page, isMobile);
  await expect(
    page.getByRole('link', { name: 'Reconnectez-vous pour envoyer' }),
  ).toBeVisible({ timeout: 15_000 });
});

test('a failing server never loses a sale, nor passes for a missing network', async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await openCheckoutOnline(page);
  await page.route('**/caisse/synchroniser', (route) =>
    route.fulfill({ status: 500, json: { error: 'panne' } }),
  );
  await sellOffline(page, isMobile);
  await expect(banner(page)).toContainText('Le serveur ne répond pas bien', {
    timeout: 15_000,
  });
  await page.unroute('**/caisse/synchroniser');
});

test('« Synchroniser » sends at once what the automatic sending put off', async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await openCheckoutOnline(page);
  await page.route('**/caisse/synchroniser', (route) =>
    route.fulfill({ status: 500, json: { error: 'panne' } }),
  );
  await sellOffline(page, isMobile);
  await expect(banner(page)).toContainText('Le serveur ne répond pas bien', {
    timeout: 15_000,
  });
  await nextSale(page);

  // Still failing: the seller is told, and nothing is lost.
  const sync = page.getByRole('button', { name: 'Synchroniser' });
  await sync.click();
  await expect(
    page.getByText(/Une opération reste sur ce téléphone, rien n’est perdu/),
  ).toBeVisible({ timeout: 15_000 });

  // Repaired: no wait of a minute, the sale leaves on the button.
  await page.unroute('**/caisse/synchroniser');
  await sync.click();
  await expect(
    page.getByText('Tout est envoyé. Produits et prix sont à jour.'),
  ).toBeVisible({ timeout: 15_000 });
  await page.getByText(/Ventes de ce téléphone \(1\)/).click();
  await expect(
    page.getByRole('list', { name: 'Ventes de ce téléphone' }),
  ).toContainText('Envoyée');
});

test('« Envoyer maintenant » in the banner does it from any page', async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await openCheckoutOnline(page);
  await page.route('**/caisse/synchroniser', (route) =>
    route.fulfill({ status: 500, json: { error: 'panne' } }),
  );
  await sellOffline(page, isMobile);
  await expect(banner(page)).toContainText('Le serveur ne répond pas bien', {
    timeout: 15_000,
  });
  await page.goto('/espace/parametres');
  await page.unroute('**/caisse/synchroniser');
  await page.getByRole('button', { name: 'Envoyer maintenant' }).click();
  await expect(banner(page)).toHaveCount(0, { timeout: 15_000 });
});

test('without network, « Synchroniser » says so and keeps everything', async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await openCheckoutOnline(page);
  await context.setOffline(true);
  await sellOffline(page, isMobile);
  await page.getByRole('button', { name: 'Synchroniser' }).click();
  await expect(
    page.getByText(/Pas de connexion internet : tout reste gardé/),
  ).toBeVisible({ timeout: 15_000 });
  await context.setOffline(false);
});

test('a refused batch does not hold the others, and the refused sale can go back', async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await openCheckoutOnline(page);
  await context.setOffline(true);
  await sellOffline(page, isMobile);
  await nextSale(page);
  await sellOffline(page, isMobile);
  await nextSale(page);

  // Any batch of two is refused, and the first sale alone too.
  let first: string | null = null;
  await page.route('**/caisse/synchroniser', async (route) => {
    const { operations } = route.request().postDataJSON() as {
      operations: { clientOperationId: string }[];
    };
    first ??= operations[0]!.clientOperationId;
    if (operations.length > 1 || operations[0]!.clientOperationId === first)
      await route.fulfill({ status: 400, json: { error: 'invalid' } });
    else await route.fallback();
  });
  await context.setOffline(false);
  await wakeUp(page);

  await expect(
    page.getByRole('heading', { name: 'Une opération refusée' }),
  ).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    page.getByText(/Le serveur ne peut pas lire cette opération/),
  ).toBeVisible();
  await page.getByText(/Ventes de ce téléphone \(2\)/).click();
  const sales = page.getByRole('list', { name: 'Ventes de ce téléphone' });
  await expect(sales).toContainText('Refusée');
  await expect(sales).toContainText('Envoyée');

  // Its content was kept: it leaves as soon as the server takes it.
  await page.unroute('**/caisse/synchroniser');
  await page.getByRole('button', { name: 'Renvoyer' }).click();
  await expect(
    page.getByRole('heading', { name: 'Une opération refusée' }),
  ).toHaveCount(0);
  await expect(sales).not.toContainText('Refusée', { timeout: 15_000 });
});

test('a sale the server no longer holds is sent again by the phone', async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await openCheckoutOnline(page);
  await context.setOffline(true);
  await sellOffline(page, isMobile);
  await context.setOffline(false);
  await expect(banner(page)).toHaveCount(0, { timeout: 15_000 });

  // A restored backup: the server answers that it does not know the sale.
  const resent: string[] = [];
  await page.route('**/caisse/verifier', async (route) => {
    const { clientOperationIds } = route.request().postDataJSON() as {
      clientOperationIds: string[];
    };
    await route.fulfill({ json: { unknown: clientOperationIds } });
  });
  page.on('request', (request) => {
    if (request.url().endsWith('/caisse/synchroniser'))
      resent.push(request.postData() ?? '');
  });
  await page.goto('/caisse');
  await expect
    .poll(() => resent.length, { timeout: 15_000 })
    .toBeGreaterThan(0);
  await page.unroute('**/caisse/verifier');
});

test('only « Effacer ce téléphone » empties it, never while sales wait', async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await openCheckoutOnline(page);
  await page.route('**/caisse/synchroniser', (route) => route.abort());
  await sellOffline(page, isMobile);
  await page.goto('/espace/parametres');
  await expect(
    page.getByText(/ne peut pas être vidé avant leur envoi/),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Effacer ce téléphone' }),
  ).toHaveCount(0);
  await page.unroute('**/caisse/synchroniser');

  await page.goto('/caisse');
  await expect(banner(page)).toHaveCount(0, { timeout: 15_000 });
  await page.goto('/espace/parametres');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: 'Effacer ce téléphone' }).click();
  await expect(page.getByText('Ce téléphone a été vidé.')).toBeVisible();
  const databases = await page.evaluate(async () =>
    (await indexedDB.databases()).map((db) => db.name),
  );
  expect(databases).not.toContain('nagaw');
});
