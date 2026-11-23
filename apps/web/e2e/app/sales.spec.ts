import { expect, test, type Page } from '@playwright/test';
import { expectAccessible } from '../support/a11y';
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

/**
 * « Caisse »: in the middle of the bottom bar on a phone, on top of the
 * sidebar on a computer (ADR-063).
 */
function sellLink(page: Page, isMobile: boolean) {
  return (
    isMobile
      ? page.getByRole('navigation', { name: 'Navigation principale' })
      : page.getByRole('complementary', { name: 'Barre latérale' })
  ).getByRole('link', { name: 'Caisse', exact: true });
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
  // No share sheet here: the ticket files are downloaded instead.
  await page.addInitScript(() =>
    Object.defineProperty(Navigator.prototype, 'canShare', {
      value: undefined,
    }),
  );
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/vendre');
  await addToCart(page, 'Eau minérale 1,5 L', 3);
  // Each tap is spoken, and the tile says what is in the cart (WCAG 4.1.3).
  await expect(
    page.getByText('Eau minérale 1,5 L ajouté. 3 dans le panier.'),
  ).toBeAttached();
  await expect(
    page.getByRole('button', { name: /^Ajouter Eau minérale 1,5 L/ }),
  ).toHaveAccessibleName(/, 3 dans le panier$/);
  if (isMobile)
    await expect(
      page.getByRole('button', { name: /^Encaisser/ }),
    ).toContainText('1 500');
  await openPayment(page, isMobile);
  // The pressed button is gone: the focus goes to the top of the cart.
  if (isMobile)
    await expect(page.getByRole('heading', { name: 'Panier' })).toBeFocused();
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

  await page.getByLabel('Le client vous donne (facultatif)').fill('2000');
  await expect(page.getByText(/Monnaie à rendre : 500/)).toBeVisible();
  await page.getByRole('button', { name: /^Valider la vente/ }).click();

  // The ticket shows in the checkout: the seller stays there.
  await expect(page).toHaveURL(/\/caisse$/);
  await expect(page.getByText('Vente enregistrée.')).toBeVisible();
  const ticket = page.getByRole('article', { name: /^Ticket n° 000001/ });
  await expect(ticket).toContainText('Eau minérale 1,5 L');
  expect(plain(await ticket.textContent())).toContain('TOTAL1 500 F CFA');
  expect(plain(await ticket.textContent())).toContain('Rendu500 F CFA');
  // Sent as a PDF or a photo; without a share sheet, the file is saved.
  const pdf = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Envoyer en PDF' }).click();
  const pdfFile = await pdf;
  expect(pdfFile.suggestedFilename()).toMatch(/^Ticket .*\.pdf$/);
  const pdfBytes = await (await pdfFile.createReadStream()).toArray();
  expect(Buffer.concat(pdfBytes).subarray(0, 8).toString()).toBe('%PDF-1.4');
  const png = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Envoyer en photo' }).click();
  expect((await png).suggestedFilename()).toMatch(/^Ticket .*\.png$/);
  await expect(
    page.getByRole('button', { name: 'Imprimer le ticket' }),
  ).toBeVisible();

  await page.goto(WATER);
  await expect(
    page.getByRole('region', { name: 'Ce qui reste' }),
  ).toContainText('21 bouteilles');
});

test('« Taper un montant » sells what is not in the catalogue, then it can become a product (ADR-069)', async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/vendre');
  // « Vente au montant » is behind its button, never a tile.
  await expect(
    page
      .getByRole('list', { name: 'Produits à vendre' })
      .getByRole('button', { name: /Vente au montant/ }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: /^Taper un montant/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Taper un montant' });
  await sheet.getByRole('button', { name: 'Ajouter au panier' }).click();
  await expect(sheet.getByText(/Tapez un montant en chiffres/)).toBeVisible();
  await sheet.getByLabel('Montant que le client paie').fill('1500');
  await sheet.getByLabel(/^Pour quoi \?/).fill('Pain');
  await sheet.getByRole('button', { name: 'Ajouter au panier' }).click();
  await expect(sheet).toBeHidden();
  await addToCart(page, 'Eau minérale 1,5 L');
  await openPayment(page, isMobile);
  const cart = page.getByRole('list', { name: 'Articles du panier' });
  await expect(cart.getByLabel('Pain', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Valider la vente/ }).click();
  await expect(page.getByText('Vente enregistrée.')).toBeVisible();
  const ticket = page.getByRole('article', { name: /^Ticket n°/ });
  await expect(ticket).toContainText('Pain');
  expect(plain(await ticket.textContent())).toContain('TOTAL2 000 F CFA');

  // The owner keeps it in the catalogue, with its price typed each time.
  await page
    .getByRole('link', { name: 'Ajouter « Pain » à vos produits' })
    .click();
  await expect(page.getByLabel('Nom du produit')).toHaveValue('Pain');
  await expect(page.getByLabel(/^Prix de vente/)).toHaveValue('1500');
  await page.getByText('Tapé à chaque vente').click();
  await expect(page.getByLabel(/^Prix habituel/)).toBeVisible();
  await page.getByLabel(/^Prix habituel/).fill('');
  await page.getByLabel('En stock').fill('10');
  await page.getByRole('button', { name: /^Enregistrer/ }).click();
  await expect(page.getByRole('heading', { name: 'Pain' })).toBeVisible();
  await expect(page.getByText('Prix tapé à chaque vente.')).toBeVisible();

  await page.goto('/espace/vendre');
  const tile = page
    .getByRole('list', { name: 'Produits à vendre' })
    .getByRole('button', { name: /^Ajouter Pain/ });
  await expect(tile).toContainText('Prix à taper');
  await tile.click();
  const price = page.getByRole('dialog', { name: 'Prix de « Pain »' });
  await price.getByLabel(/^Prix que le client paie/).fill('700');
  await price.getByRole('button', { name: 'Garder ce prix' }).click();
  await openPayment(page, isMobile);
  await page.getByRole('button', { name: /^Valider la vente/ }).click();
  await expect(page.getByText('Vente enregistrée.')).toBeVisible();
  expect(
    plain(
      await page.getByRole('article', { name: /^Ticket n°/ }).textContent(),
    ),
  ).toContain('TOTAL700 F CFA');
});

test('a product sold often, not counted, is suggested on the home page (ADR-070)', async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/produits/nouveau');
  await page.getByLabel('Nom du produit').fill('Beignet');
  await page.getByLabel(/^Prix de vente/).fill('100');
  await page.getByText('Code-barres, catégorie, seuil d’alerte').click();
  await page.getByLabel('Suivre le stock de ce produit').uncheck();
  await page.getByRole('button', { name: 'Enregistrer le produit' }).click();
  await expect(page.getByRole('heading', { name: 'Beignet' })).toBeVisible();

  for (let i = 0; i < 2; i++) {
    await page.goto('/espace/vendre');
    await addToCart(page, 'Beignet');
    await openPayment(page, isMobile);
    await page.getByRole('button', { name: /^Valider la vente/ }).click();
    await expect(page.getByText('Vente enregistrée.')).toBeVisible();
  }

  await page.goto('/espace');
  const card = page.getByRole('region', { name: 'Compter le stock ?' });
  await expect(card).toContainText('Vous vendez souvent Beignet');
  await card.getByRole('link', { name: 'Compter son stock' }).click();
  await expect(page).toHaveURL(/\/modifier\?compter=1$/);
  await expect(page.getByLabel('Suivre le stock de ce produit')).toBeChecked();

  await page.goto('/espace');
  await card.getByRole('button', { name: 'Plus tard' }).click();
  await expect(card).toBeHidden();
});

test('a code read by a reader puts its product straight in the cart (ADR-068)', async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/caisse');
  const search = page.getByRole('searchbox', { name: /Chercher un produit/ });
  // An unknown code adds nothing: it only filters the list.
  await search.fill('0000000000000');
  await search.press('Enter');
  await expect(search).toHaveValue('0000000000000');
  // A reader types the code, then « Entrée »: twice, two bottles.
  await search.fill('6111234500014');
  await search.press('Enter');
  await expect(search).toHaveValue('');
  await expect(
    page.getByText('Eau minérale 1,5 L ajouté au panier.'),
  ).toBeAttached();
  await search.fill('6111234500014');
  await search.press('Enter');
  await openPayment(page, isMobile);
  const cart = page.getByRole('list', { name: 'Articles du panier' });
  await expect(
    cart.getByLabel('Eau minérale 1,5 L', { exact: true }),
  ).toHaveValue('2');
});

/** The bars of EAN-13 6111234500014, the water's code in the fake shop. */
function ean13Bars(code: string): string {
  const L = [
    '0001101',
    '0011001',
    '0010011',
    '0111101',
    '0100011',
    '0110001',
    '0101111',
    '0111011',
    '0110111',
    '0001011',
  ];
  const G = [
    '0100111',
    '0110011',
    '0011011',
    '0100001',
    '0011101',
    '0111001',
    '0000101',
    '0010001',
    '0001001',
    '0010111',
  ];
  const R = [
    '1110010',
    '1100110',
    '1101100',
    '1000010',
    '1011100',
    '1001110',
    '1010000',
    '1000100',
    '1001000',
    '1110100',
  ];
  const PARITY = [
    'LLLLLL',
    'LLGLGG',
    'LLGGLG',
    'LLGGGL',
    'LGLLGG',
    'LGGLLG',
    'LGGGLL',
    'LGLGLG',
    'LGLGGL',
    'LGGLGL',
  ];
  const d = [...code].map(Number);
  let bits = '101';
  d.slice(1, 7).forEach((n, i) => {
    bits += (PARITY.at(d[0]!)!.at(i) === 'L' ? L : G).at(n);
  });
  bits += '01010';
  d.slice(7).forEach((n) => {
    bits += R.at(n);
  });
  return bits + '101';
}

test('the camera reads a barcode and its product goes in the cart once (ADR-068)', async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  // The camera films a drawn barcode, held in view the whole time.
  await page.addInitScript((bits: string) => {
    navigator.mediaDevices.getUserMedia = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const g = canvas.getContext('2d')!;
      const draw = () => {
        g.fillStyle = '#fff';
        g.fillRect(0, 0, 640, 480);
        g.fillStyle = '#000';
        const x0 = (640 - bits.length * 4) / 2;
        [...bits].forEach((bit, i) => {
          if (bit === '1') g.fillRect(x0 + i * 4, 140, 4, 200);
        });
      };
      draw();
      setInterval(draw, 100);
      return canvas.captureStream(10);
    };
  }, ean13Bars('6111234500014'));
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/caisse');
  await page
    .getByRole('button', { name: 'Scanner un produit avec la caméra' })
    .click();
  const sheet = page.getByRole('dialog', { name: 'Scanner un produit' });
  await expect(sheet.getByRole('status')).toHaveText(
    'Eau minérale 1,5 L ajouté au panier.',
    { timeout: 15_000 },
  );
  // Still in view two seconds later: counted once, not again.
  await page.waitForTimeout(2_000);
  await sheet.getByRole('button', { name: 'Terminé' }).click();
  await openPayment(page, isMobile);
  await expect(
    page
      .getByRole('list', { name: 'Articles du panier' })
      .getByLabel('Eau minérale 1,5 L', { exact: true }),
  ).toHaveValue('1');
});

test('« Scanner » opens the camera, and says so when there is none', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/caisse');
  await page
    .getByRole('button', { name: 'Scanner un produit avec la caméra' })
    .click();
  const sheet = page.getByRole('dialog', { name: 'Scanner un produit' });
  await expect(sheet).toBeVisible();
  // No camera on the test browser: the sheet says what to do instead.
  await expect(sheet.getByRole('alert')).toContainText(/caméra/);
  await expectAccessible(page, 'scanner');
  await sheet.getByRole('button', { name: 'Terminé' }).click();
  await expect(sheet).toBeHidden();
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
    page.getByRole('region', { name: 'Reste à payer' }),
  ).toContainText(/1\s000/);
  await expect(
    page.getByRole('link', {
      name: 'Envoyer le rappel à Fatou Ndiaye sur WhatsApp',
    }),
  ).toHaveAttribute(
    'href',
    /^https:\/\/wa\.me\/221771112233\?text=Bonjour%20Fatou/,
  );
  await page.getByLabel(/Montant reçu/).fill('400');
  await page
    .getByRole('button', { name: 'Enregistrer le remboursement' })
    .click();
  await expect(page.getByText('Remboursement enregistré.')).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Reste à payer' }),
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
  isMobile,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/ventes');
  const list = page.getByRole('list', { name: 'Liste des ventes' });
  await expect(list.getByRole('listitem').first()).toBeVisible();
  const summary = page.getByRole('region', { name: 'Aujourd’hui' });
  await expect(summary.getByRole('heading')).toContainText(/\d+ ventes?/);
  await expect(sellLink(page, isMobile)).toBeVisible();
  // « Nouvelle vente » opens the caisse from the list of sales.
  await expect(
    page.getByRole('main').getByRole('link', { name: 'Nouvelle vente' }),
  ).toHaveAttribute('href', '/caisse');
  await page.getByRole('link', { name: 'Hier' }).click();
  await expect(page.getByText('Aucune vente ce jour-là')).toBeVisible();

  // The home page lists the last sales (ADR-063).
  await page.goto('/espace');
  await expect(
    page
      .getByRole('region', { name: 'Dernières ventes' })
      .getByRole('link', { name: /^Ticket/ })
      .first(),
  ).toBeVisible();
  await expect(sellLink(page, isMobile)).toBeVisible();
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
