import { expect, test, type Page } from '@playwright/test';
import { resetBackend, signInAs } from '../support/session';

test.describe.configure({ mode: 'serial' });

const WATER = '/espace/produits/dddddddd-0000-4000-8000-000000000001';
const FATOU = '/espace/clients/eeeeeeee-0000-4000-8000-000000000001';

test.beforeAll(async () => {
  await resetBackend();
});

const plain = (text: string | null) => (text ?? '').replace(/[  ]/g, ' ');

async function addToCart(page: Page, name: string, times = 1) {
  const tile = page
    .getByRole('list', { name: 'Produits à vendre' })
    .getByRole('button', { name: new RegExp(`^Ajouter ${name}`) });
  for (let i = 0; i < times; i++) await tile.click();
}

/** On phones the payment is a second step; on desktop it is beside. */
async function openPayment(page: Page, isMobile: boolean) {
  if (isMobile) await page.getByRole('button', { name: /^Encaisser/ }).click();
  await expect(page.getByRole('heading', { name: 'Paiement' })).toBeVisible();
}

test('a cash sale shows the change, the ticket and lowers the stock', async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/vendre');
  await addToCart(page, 'Eau minérale 1,5 L', 3);
  if (isMobile)
    await expect(
      page.getByRole('button', { name: /^Encaisser/ }),
    ).toContainText('1 500');
  await openPayment(page, isMobile);
  const cart = page.getByRole('list', { name: 'Articles du panier' });
  await expect(
    cart.getByLabel('Eau minérale 1,5 L', { exact: true }),
  ).toHaveValue('3');
  await cart
    .getByRole('button', { name: 'Un de moins : Eau minérale 1,5 L' })
    .click();
  await cart
    .getByRole('button', { name: 'Un de plus : Eau minérale 1,5 L' })
    .click();

  await page.getByLabel('Somme reçue du client (facultatif)').fill('2000');
  await expect(page.getByText(/À rendre : 500/)).toBeVisible();
  await page.getByRole('button', { name: /^Valider la vente/ }).click();

  await expect(page).toHaveURL(/\/espace\/ventes\/[^/?]+\?nouvelle=1$/);
  await expect(page.getByText('Vente enregistrée.')).toBeVisible();
  const ticket = page.getByRole('article', { name: /^Ticket n° 000001/ });
  await expect(ticket).toContainText('Eau minérale 1,5 L');
  expect(plain(await ticket.textContent())).toContain('TOTAL1 500 F CFA');
  expect(plain(await ticket.textContent())).toContain('Rendu500 F CFA');
  const whatsapp = page.getByRole('link', { name: 'Envoyer sur WhatsApp' });
  await expect(whatsapp).toHaveAttribute(
    'href',
    /^https:\/\/wa\.me\/\?text=Acme%20Dakar/,
  );
  await expect(
    page.getByRole('button', { name: 'Imprimer le ticket' }),
  ).toBeVisible();

  await page.goto(WATER);
  await expect(
    page.getByRole('region', { name: 'Ce qui reste' }),
  ).toContainText('21 bouteilles');
});

test('the checkout asks what is missing before sending', async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/vendre');
  await addToCart(page, 'Eau minérale 1,5 L');
  await openPayment(page, isMobile);

  await page.getByRole('button', { name: 'Mobile Money', exact: true }).click();
  await page.getByRole('button', { name: /^Valider la vente/ }).click();
  await expect(
    page.getByText('Choisissez l’opérateur Mobile Money.'),
  ).toBeVisible();

  await page.getByRole('button', { name: 'À crédit', exact: true }).click();
  await page.getByRole('button', { name: /^Valider la vente/ }).click();
  await expect(
    page.getByText('Choisissez le client qui paiera plus tard.'),
  ).toBeVisible();
});

test('a sale on credit shows on the customer, who pays back later', async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  test.skip(isMobile, 'One credit sale is enough for both layouts');
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/vendre');
  await addToCart(page, 'Eau minérale 1,5 L', 2);
  await openPayment(page, isMobile);
  await page.getByRole('button', { name: 'À crédit', exact: true }).click();
  await page
    .getByLabel('Client qui paiera plus tard')
    .selectOption({ label: 'Fatou Ndiaye — 77 111 22 33' });
  await page.getByRole('button', { name: /^Valider la vente/ }).click();
  await expect(page.getByText('Vente enregistrée.')).toBeVisible();

  await page.goto('/espace/clients?doivent=1');
  const list = page.getByRole('list', { name: 'Liste des clients' });
  await expect(list).toContainText('Fatou Ndiaye');
  expect(plain(await list.textContent())).toContain('Doit 1 000 F CFA');

  await page.goto(FATOU);
  await expect(
    page.getByRole('region', { name: 'Ce que le client doit' }),
  ).toContainText(/1\s000/);
  await page.getByLabel(/Montant reçu/).fill('400');
  await page
    .getByRole('button', { name: 'Enregistrer le remboursement' })
    .click();
  await expect(page.getByText('Remboursement enregistré.')).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Ce que le client doit' }),
  ).toContainText(/600/);
  const history = page.getByRole('list', { name: 'Historique du client' });
  await expect(history.getByRole('listitem')).toHaveCount(2);
});

test('a new customer can be created at the counter', async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  test.skip(isMobile, 'Covered once');
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/vendre');
  await addToCart(page, 'Eau minérale 1,5 L');
  await openPayment(page, isMobile);
  await page.getByRole('button', { name: 'Nouveau client' }).click();
  await page.getByLabel('Nom du nouveau client').fill('Moustapha Sow');
  await page.getByLabel('Téléphone (facultatif)').fill('70 555 44 33');
  await page.getByRole('button', { name: 'Ajouter le client' }).click();
  await expect(
    page.getByLabel('Client (facultatif)', { exact: true }),
  ).toHaveValue(/.+/);
  await page.getByRole('button', { name: /^Valider la vente/ }).click();
  await expect(page.getByRole('article', { name: /^Ticket/ })).toContainText(
    'Client : Moustapha Sow',
  );
});

test('a manager cancels a sale and the goods come back', async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  test.skip(isMobile, 'Covered once');
  await signInAs(context, 'awa', baseURL!);
  await page.goto(WATER);
  const before = await page
    .getByRole('region', { name: 'Ce qui reste' })
    .textContent();

  await page.goto('/espace/ventes');
  await page
    .getByRole('list', { name: 'Liste des ventes' })
    .getByRole('link')
    .first()
    .click();
  await page.getByRole('button', { name: 'Annuler la vente' }).click();
  await expect(
    page.getByText('Indiquez pourquoi la vente est annulée'),
  ).toBeVisible();
  await page
    .getByLabel('Pourquoi annuler cette vente ?')
    .fill('Erreur de saisie');
  await page.getByRole('button', { name: 'Annuler la vente' }).click();
  await expect(
    page.getByText(/Vente annulée le .* : Erreur de saisie/),
  ).toBeVisible();
  await expect(page.getByRole('article', { name: /^Ticket/ })).toContainText(
    'VENTE ANNULÉE',
  );

  await page.goto(WATER);
  await expect(
    page.getByRole('region', { name: 'Ce qui reste' }),
  ).not.toHaveText(before!);
});

test('sales of the day are listed with their totals, and on the home page', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/ventes');
  const list = page.getByRole('list', { name: 'Liste des ventes' });
  await expect(list.getByRole('listitem').first()).toBeVisible();
  const summary = page.getByRole('region', { name: 'Aujourd’hui' });
  await expect(summary.getByText('Ventes', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Hier' }).click();
  await expect(page.getByText('Aucune vente ce jour-là')).toBeVisible();

  await page.goto('/espace');
  await expect(
    page.getByRole('region', { name: 'Aujourd’hui' }).getByText('Ventes', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('main').getByRole('link', { name: 'Vendre', exact: true }),
  ).toBeVisible();
});

test('a seller sells and sees only their own sales, and cannot cancel', async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  await signInAs(context, 'moussa', baseURL!);
  await page.goto('/espace/ventes');
  await expect(page.getByText('Vos ventes.')).toBeVisible();
  const countBefore = await page
    .getByRole('list', { name: 'Liste des ventes' })
    .getByRole('listitem')
    .count();

  await page.goto('/espace/vendre');
  await addToCart(page, 'Eau minérale 1,5 L');
  await openPayment(page, isMobile);
  await page.getByRole('button', { name: /^Valider la vente/ }).click();
  await expect(page.getByText('Vente enregistrée.')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Annuler la vente' }),
  ).toHaveCount(0);

  await page.goto('/espace/ventes');
  await expect(
    page.getByRole('list', { name: 'Liste des ventes' }).getByRole('listitem'),
  ).toHaveCount(countBefore + 1);
});
