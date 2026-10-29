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
