import { expect, test } from '@playwright/test';
import { expectAccessible } from '../support/a11y';
import { resetBackend, signInAs } from '../support/session';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await resetBackend();
});

test('a shop owner cannot open the administration', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/admin');
  await expect(
    page.getByText(
      'Cet espace est réservé à l’administration de la plateforme.',
    ),
  ).toBeVisible();
  await page.goto('/espace');
  await expect(
    page.getByRole('link', { name: 'Administration de la plateforme' }),
  ).toHaveCount(0);
});

test('the platform accepts a request to change offer', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/abonnement');
  await page
    .getByRole('button', { name: 'Demander l’offre Essentiel' })
    .click();
  await expect(
    page.getByText(/Demande de passage à l’offre Essentiel envoyée/),
  ).toBeVisible();

  await context.clearCookies();
  await signInAs(context, 'binta', baseURL!);
  await page.goto('/admin');
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Tableau de bord',
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('list', { name: '1 alerte à regarder' }),
  ).toContainText('1 demande(s) de changement d’offre en attente.');
  await expectAccessible(page, 'administration');
  await page
    .getByRole('link', { name: 'Traiter les demandes d’offre' })
    .click();
  const list = page.getByRole('list', { name: 'Liste des demandes' });
  await expect(list).toContainText('Pro → Essentiel');
  await expectAccessible(page, 'demandes');
  await list.getByLabel('Remarque (facultatif)').fill('Payé par Wave');
  await list
    .getByRole('button', { name: 'Accepter la demande de Acme Dakar' })
    .click();
  // The shop then shows its new offer and the accepted request.
  await expect(
    page.getByRole('heading', { level: 1, name: 'Acme Dakar' }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Offre Essentiel' }),
  ).toContainText('Acceptée');

  await context.clearCookies();
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/abonnement');
  await expect(
    page.getByRole('heading', { level: 2, name: 'Offre Essentiel' }),
  ).toBeVisible();
});

test('the platform suspends and reactivates a shop', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'binta', baseURL!);
  await page.goto('/admin/boutiques');
  await expectAccessible(page, 'boutiques');
  await page.getByRole('link', { name: /^Globex Sénégal/ }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Globex Sénégal' }),
  ).toBeVisible();
  await expectAccessible(page, 'fiche boutique');
  await page
    .getByLabel('Pourquoi suspendre cette boutique ?')
    .fill('Paiement contesté');
  await page.getByRole('button', { name: 'Suspendre la boutique' }).click();
  await expect(
    page.getByText(/Suspendue le .*Paiement contesté/),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Réactiver la boutique' }).click();
  await expect(
    page.getByRole('button', { name: 'Suspendre la boutique' }),
  ).toBeVisible();

  await page.goto('/admin/synchronisation');
  // The figures of the chart, in a table under « Voir les chiffres ».
  await page.getByText('Voir les chiffres en tableau').click();
  await expect(
    page.getByRole('table', {
      name: 'Opérations acceptées et refusées, par jour',
    }),
  ).toBeVisible();
  await expectAccessible(page, 'synchronisation');
});

test('an invoice to pay shows to the owner, and the platform marks it paid (ADR-073)', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/abonnement');
  await expect(page.getByText(/^Facture à payer : 15\s000/)).toBeVisible();
  await expect(page.getByText('AB-ABABAB', { exact: true })).toBeVisible();

  await context.clearCookies();
  await signInAs(context, 'binta', baseURL!);
  await page.goto('/admin/factures');
  await expectAccessible(page, 'factures');
  await page
    .getByRole('button', { name: /^Marquer payée : AB-ABABAB, Acme Dakar/ })
    .click();
  // Paid, it leaves the invoices to collect.
  await expect(page.getByText('Rien à encaisser')).toBeVisible();
});

test('the platform extends a term by hand and gives a lifetime subscription', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'binta', baseURL!);
  await page.goto('/admin/boutiques');
  await page.getByRole('link', { name: /^Acme Dakar/ }).click();
  const term = page.getByRole('region', { name: 'Durée et factures' });
  await term.getByLabel('Remarque (facultatif)').fill('Espèces');
  await term.getByRole('button', { name: 'Prolonger de 1 an' }).click();
  await expect(page.getByText('Abonnement prolongé.')).toBeVisible();
  await expect(term).toContainText('1 an, jusqu’au');

  await term
    .getByRole('button', { name: 'Abonnement à vie', exact: true })
    .click();
  const dialog = page.getByRole('alertdialog', {
    name: 'Abonnement à vie pour Acme Dakar ?',
  });
  await dialog.getByRole('button', { name: 'Abonnement à vie' }).click();
  await expect(term).toContainText('Abonnement à vie');
  await expect(
    term.getByRole('button', { name: 'Retirer l’abonnement à vie' }),
  ).toBeVisible();

  await context.clearCookies();
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/abonnement');
  await expect(
    page.getByText('Abonnement à vie, offert par Nagaw : rien à payer.'),
  ).toBeVisible();
});

test('the platform archives an account and a shop, then restores them (ADR-074)', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'binta', baseURL!);
  await page.goto('/admin/comptes?q=moussa');
  await expectAccessible(page, 'comptes');
  const accounts = page.getByRole('list', { name: 'Liste des comptes' });
  await accounts.getByLabel('Pourquoi archiver ?').fill('A quitté la boutique');
  await accounts
    .getByRole('button', { name: 'Archiver le compte : moussa@acme.test' })
    .click();
  await page
    .getByRole('alertdialog', { name: 'Archiver moussa@acme.test ?' })
    .getByRole('button', { name: 'Archiver' })
    .click();
  await expect(accounts).toHaveCount(0);

  await context.clearCookies();
  await signInAs(context, 'moussa', baseURL!);
  await page.goto('/espace');
  await expect(page.getByText(/Ce compte est archivé/)).toBeVisible();

  await context.clearCookies();
  await signInAs(context, 'binta', baseURL!);
  await page.goto('/admin/comptes?vue=archives');
  await page
    .getByRole('button', { name: 'Rouvrir le compte : moussa@acme.test' })
    .click();
  await expect(page.getByText('Aucun compte archivé')).toBeVisible();

  await page.goto('/admin/boutiques');
  await page.getByRole('link', { name: /^Globex Sénégal/ }).click();
  const archive = page.getByRole('region', { name: 'Archiver' });
  await archive.getByLabel('Pourquoi archiver ?').fill('Fermée');
  await archive
    .getByRole('button', { name: 'Archiver la boutique : Globex Sénégal' })
    .click();
  await page
    .getByRole('alertdialog', { name: 'Archiver Globex Sénégal ?' })
    .getByRole('button', { name: 'Archiver' })
    .click();
  await expect(page.getByText(/Archivée le .*Fermée/)).toBeVisible();
  await page.goto('/admin/boutiques');
  await expect(page.getByRole('link', { name: /^Globex Sénégal/ })).toHaveCount(
    0,
  );
  await page.getByRole('link', { name: 'Archivées' }).click();
  await page.getByRole('link', { name: /^Globex Sénégal/ }).click();
  await page
    .getByRole('button', { name: 'Restaurer la boutique : Globex Sénégal' })
    .click();
  await expect(
    page.getByRole('button', { name: 'Suspendre la boutique' }),
  ).toBeVisible();
});

test('once entered with a reason, the platform archives a product and restores it (ADR-074)', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'binta', baseURL!);
  await page.goto('/admin/boutiques');
  await page.getByRole('link', { name: /^Acme Dakar/ }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Acme Dakar' }),
  ).toBeVisible();
  const shopUrl = page.url();
  await page
    .getByLabel('Pourquoi entrez-vous dans cette boutique ?')
    .fill('Ménage demandé par Awa');
  await page.getByRole('button', { name: 'Entrer dans la boutique' }).click();
  await page.waitForURL(/\/espace/);
  await page.goto(shopUrl);
  await page.getByRole('link', { name: 'Gérer ses données' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Données de Acme Dakar' }),
  ).toBeVisible();
  await expectAccessible(page, 'données de la boutique');
  const products = page.getByRole('list', {
    name: 'Produits de la boutique',
  });
  const soap = products.getByRole('listitem').filter({ hasText: 'Savon' });
  await soap.getByLabel('Pourquoi ?').fill('Plus vendu');
  await soap.getByRole('button', { name: /^Archiver : Savon/ }).click();
  await expect(products.getByText(/^Savon/)).toHaveCount(0);
  await page.getByRole('link', { name: 'Archivés' }).click();
  await products.getByRole('button', { name: /^Restaurer : Savon/ }).click();
  await expect(page.getByText('Rien ici')).toBeVisible();
});
