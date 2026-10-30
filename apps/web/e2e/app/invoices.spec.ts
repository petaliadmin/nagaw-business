import { expect, test, type Page } from '@playwright/test';
import { expectAccessible } from '../support/a11y';
import { resetBackend, signInAs } from '../support/session';

test.describe.configure({ mode: 'serial' });

const YEAR = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Dakar',
  year: 'numeric',
}).format(new Date());

test.beforeAll(async () => {
  await resetBackend();
});

const plain = (text: string | null) => (text ?? '').replace(/[  ]/g, ' ');
const line = (page: Page, n: number) =>
  page.getByRole('listitem', { name: `Ligne ${n}` });

/** Fatou buys 4 bottles of water and a delivery: 3 500 F. */
async function fillInvoice(page: Page) {
  await page
    .getByLabel('Client', { exact: true })
    .selectOption({ label: 'Fatou Ndiaye' });
  await line(page, 1)
    .getByLabel('Produit du catalogue')
    .selectOption({ label: 'Eau minérale 1,5 L' });
  await expect(line(page, 1).getByLabel('Désignation')).toHaveValue(
    'Eau minérale 1,5 L',
  );
  await line(page, 1).getByLabel('Quantité').fill('4');
  await page.getByRole('button', { name: 'Ajouter une ligne' }).click();
  await line(page, 2).getByLabel('Désignation').fill('Livraison à domicile');
  await line(page, 2).getByLabel('Prix unitaire TTC').fill('1500');
  await expect(
    page.getByRole('definition').filter({ hasText: /^3\s500\sF/ }),
  ).toBeVisible();
}

test('an invoice is drafted, issued with its number, paid in part', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/factures/liste');
  await expect(page.getByText('Aucune facture pour le moment')).toBeVisible();
  await page.getByRole('link', { name: 'Nouvelle facture' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Nouvelle facture' }),
  ).toBeVisible();
  await fillInvoice(page);
  await page.getByRole('button', { name: 'Enregistrer le brouillon' }).click();

  await expect(page).toHaveURL(/\/espace\/factures\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Facture (brouillon)',
  );
  await expectAccessible(page, 'facture brouillon');
  await page.getByRole('button', { name: 'Émettre la facture' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    `Facture F-${YEAR}-0001`,
  );
  await expect(page.getByText('À payer', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Modifier' })).toHaveCount(0);

  await page.getByLabel('Montant reçu').fill('1000');
  await page.getByRole('button', { name: 'Enregistrer le paiement' }).click();
  await expect(page.getByText('Paiement enregistré.')).toBeVisible();
  await expect(page.getByText('Payée en partie')).toBeVisible();
  expect(plain(await page.getByRole('main').textContent())).toContain(
    'Reste à payer2 500 F CFA',
  );
  await expectAccessible(page, 'facture émise');

  const pdf = await page.request.get(`${page.url()}/pdf`);
  expect(pdf.headers()['content-type']).toBe('application/pdf');

  await page.goto('/espace/factures/liste');
  const list = page.getByRole('list', { name: 'Liste des factures' });
  await expect(list).toContainText(`Facture F-${YEAR}-0001`);
  await expect(list).toContainText('Fatou Ndiaye');
});

test('the editor keeps what was typed when something is missing', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/factures/nouvelle');
  await line(page, 1).getByLabel('Désignation').fill('Conseil');
  await line(page, 1).getByLabel('Prix unitaire TTC').fill('abc');
  await page.getByRole('button', { name: 'Enregistrer le brouillon' }).click();
  await expect(page.getByText('Montant invalide').first()).toBeVisible();
  await expect(line(page, 1).getByLabel('Désignation')).toHaveValue('Conseil');
  await expect(page).toHaveURL(/\/nouvelle$/);
});

test('an unpaid invoice is cancelled by a credit note', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/factures/nouvelle');
  await fillInvoice(page);
  await page.getByRole('button', { name: 'Enregistrer le brouillon' }).click();
  await page.getByRole('button', { name: 'Émettre la facture' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    `Facture F-${YEAR}-0002`,
  );
  await page
    .getByLabel('Pourquoi annuler cette facture ?')
    .fill('Erreur de client');
  await page.getByRole('button', { name: 'Annuler par un avoir' }).click();
  await expect(page.getByText('Annulée', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: `Voir l’avoir A-${YEAR}-0001` }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    `Avoir A-${YEAR}-0001`,
  );
  await expect(
    page.getByText(`Cet avoir annule la facture F-${YEAR}-0002`),
  ).toBeVisible();
});

test('an accepted quote becomes an invoice', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/factures/devis');
  await page.getByRole('link', { name: 'Nouveau devis' }).click();
  await fillInvoice(page);
  await expect(page.getByLabel('Valable jusqu’au')).not.toHaveValue('');
  await page.getByRole('button', { name: 'Créer le devis' }).click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    `Devis D-${YEAR}-0001`,
  );
  await expectAccessible(page, 'devis');
  await page.getByRole('button', { name: 'Marquer comme envoyé' }).click();
  await expect(page.getByText('Envoyé', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Le client accepte' }).click();
  await expect(page.getByText('Accepté', { exact: true })).toBeVisible();
  await page
    .getByRole('button', { name: 'Faire la facture de ce devis' })
    .click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Facture (brouillon)',
  );
  await expect(
    page.getByRole('link', { name: `D-${YEAR}-0001` }),
  ).toBeVisible();
  expect(plain(await page.getByRole('main').textContent())).toContain(
    'Total TTC3 500 F CFA',
  );
});

test('a sale paid at the counter gets a settled invoice', async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/vendre');
  await page
    .getByRole('list', { name: 'Produits à vendre' })
    .getByRole('button', { name: /^Ajouter Eau minérale 1,5 L/ })
    .click();
  if (isMobile) await page.getByRole('button', { name: /^Encaisser/ }).click();
  await page.getByRole('button', { name: /^Valider la vente/ }).click();
  await expect(page.getByText('Vente enregistrée.')).toBeVisible();

  await page
    .getByLabel('Facture au nom de')
    .selectOption({ label: 'Fatou Ndiaye' });
  await page.getByRole('button', { name: 'Faire une facture' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Facture (brouillon)',
  );
  await page.getByRole('button', { name: 'Émettre la facture' }).click();
  await expect(page.getByText('Payée', { exact: true })).toBeVisible();
  await expect(page.getByText(/réglé en caisse/)).toBeVisible();
});

test('the shop identity printed on documents is set in the settings', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/parametres');
  const card = page.getByRole('region', { name: 'Factures et devis' });
  await card.getByLabel('NINEA (facultatif)').fill('0012345 2G3');
  await card.getByLabel('Délai de paiement des factures (jours)').fill('15');
  await card.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(card.getByText('Paramètres enregistrés.')).toBeVisible();
  await page.reload();
  await expect(
    page
      .getByRole('region', { name: 'Factures et devis' })
      .getByLabel('NINEA (facultatif)'),
  ).toHaveValue('0012345 2G3');
});

test('a document is read in the page, with its download at hand', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/factures/liste');
  await page
    .getByRole('list', { name: 'Liste des factures' })
    .getByRole('link')
    .first()
    .click();
  await page.getByRole('link', { name: 'Voir le PDF' }).click();
  await expect(page).toHaveURL(/apercu$/);
  const sheet = page.getByRole('img', { name: /page 1 sur 1$/ });
  await expect(sheet).toBeVisible();
  const before = (await sheet.boundingBox())!.width;
  await page.getByRole('button', { name: 'Agrandir' }).click();
  await expect
    .poll(async () => (await sheet.boundingBox())!.width)
    .toBeGreaterThan(before);
  await expect(page.getByRole('link', { name: 'Télécharger' })).toHaveAttribute(
    'href',
    /pdf$/,
  );
  await expectAccessible(page, 'aperçu du PDF');

  // « Retour » leads back to the document.
  if (await page.getByRole('link', { name: 'Retour' }).isVisible())
    await expect(page.getByRole('link', { name: 'Retour' })).toHaveAttribute(
      'href',
      /factures.[0-9a-f-]{36}$/,
    );
});

test('the preview of a document of another shop is not found', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  const response = await page.goto(
    '/espace/factures/00000000-0000-4000-8000-000000000000/apercu',
  );
  expect(response?.status()).toBeLessThan(500);
  await expect(page.getByRole('img', { name: /page 1/ })).toHaveCount(0);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Introuvable' }),
  ).toBeVisible();
});

test('the summary counts the documents, and leads to the rest', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/factures');
  const invoices = page.getByRole('region', { name: 'Factures' });
  await expect(invoices.getByText('Reste à encaisser')).toBeVisible();
  await expect(invoices).toContainText(/\d+ factures?/);
  await expect(
    page.getByRole('region', { name: 'Devis' }).getByText('Acceptés'),
  ).toBeVisible();

  const tabs = page.getByRole('navigation', { name: 'Factures et devis' });
  await tabs.getByRole('link', { name: 'Devis' }).click();
  await expect(page).toHaveURL(/\/espace\/factures\/devis$/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Devis' }),
  ).toBeVisible();
  await tabs.getByRole('link', { name: 'Nouveau' }).click();
  await expect(
    page.getByRole('link', { name: /^Nouvelle facture/ }),
  ).toBeVisible();
  await page.getByRole('link', { name: /^Nouveau devis/ }).click();
  await expect(page).toHaveURL(/\/espace\/factures\/devis\/nouveau$/);

  // The former address of the quotes still works.
  await page.goto('/espace/factures?type=devis');
  await expect(page).toHaveURL(/\/espace\/factures\/devis$/);
});

test('a seller reads the lists, prepares quotes, and sees no total', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'moussa', baseURL!);
  await page.goto('/espace/factures');
  await expect(page).toHaveURL(/factures.liste$/);
  await expect(page.getByText('Reste à encaisser')).toHaveCount(0);
  const tabs = page.getByRole('navigation', { name: 'Factures et devis' });
  await expect(tabs.getByRole('link', { name: 'Résumé' })).toHaveCount(0);

  await page.goto('/espace/factures/nouveau');
  await expect(
    page.getByRole('link', { name: /^Nouveau devis/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: /^Nouvelle facture/ }),
  ).toHaveCount(0);
});
