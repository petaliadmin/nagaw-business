import { expect, test } from '@playwright/test';
import { resetBackend, signInAs } from '../support/session';

test.describe.configure({ mode: 'serial' });

const MOUSSA = 'aaaaaaaa-0000-4000-8000-000000000002';
let responsibilityPath: string;

test.beforeAll(async () => {
  await resetBackend();
});

test('the application offers no agents and no automation', async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace');
  if (isMobile) await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('link', { name: 'Agents' })).toHaveCount(0);
  await expect(page.getByText(/agent|intelligence artificielle/i)).toHaveCount(
    0,
  );
  const response = await page.goto('/espace/agents');
  expect(response?.status()).toBe(404);
});

test('owner entrusts a responsibility to a team member', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/responsabilites/nouvelle');
  await expect(page.getByText('Déclenchement manuel uniquement')).toBeVisible();
  await page.getByLabel('Titre', { exact: true }).fill('Relance des devis');
  await page
    .getByLabel('Personne responsable')
    .selectOption({ label: 'moussa@acme.test' });
  await page
    .getByLabel('Objectif', { exact: true })
    .fill('Aucun devis sans suivi.');
  await page
    .getByLabel('Critères de réussite')
    .fill('Chaque devis relancé sous sept jours.');
  await page
    .getByRole('button', { name: 'Créer la responsabilité (brouillon)' })
    .click();

  const main = page.getByRole('main');
  await expect(
    main.getByRole('heading', { level: 1, name: 'Relance des devis' }),
  ).toBeVisible();
  responsibilityPath = new URL(page.url()).pathname;
  const summary = page.getByRole('region', { name: 'Résumé' });
  await expect(summary).toContainText('Responsablemoussa@acme.test');
  await expect(summary).toContainText('DéclenchementManuel');
  await expect(main.getByText('Brouillon', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Historique' })).toContainText(
    'Responsabilité créée — awa@acme.test',
  );
});

test('the person in charge can be preselected from a link', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto(`/espace/responsabilites/nouvelle?responsable=${MOUSSA}`);
  await expect(page.getByLabel('Personne responsable')).toHaveValue(MOUSSA);
});

test('the responsibility is activated, edited and its history kept', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto(responsibilityPath);
  await page.getByRole('button', { name: 'Activer' }).click();
  const main = page.getByRole('main');
  await expect(main.getByText('Active', { exact: true })).toBeVisible();

  const edit = page.getByRole('region', { name: 'Modifier' });
  await edit
    .getByLabel('Titre', { exact: true })
    .fill('Relance des devis clients');
  await edit.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(edit.getByText('Responsabilité enregistrée.')).toBeVisible();

  const history = page.getByRole('region', { name: 'Historique' });
  await expect(history).toContainText('Brouillon → Active');
  await expect(history).toContainText('Responsabilité modifiée');

  await page.goto('/espace');
  const overview = page.getByRole('region', { name: 'Votre organisation' });
  await expect(overview.getByText('Responsabilités actives')).toBeVisible();
  await expect(overview.locator('dd').nth(1)).toHaveText('1');
});

test('activation is refused without success criteria', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/responsabilites/nouvelle');
  await page.getByLabel('Titre', { exact: true }).fill('Suivi des impayés');
  await page
    .getByLabel('Objectif', { exact: true })
    .fill('Aucun impayé oublié.');
  await page
    .getByRole('button', { name: 'Créer la responsabilité (brouillon)' })
    .click();
  await expect(
    page.getByRole('main').getByRole('heading', {
      level: 1,
      name: 'Suivi des impayés',
    }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Activer' }).click();
  await expect(
    page
      .getByRole('main')
      .getByRole('alert')
      .filter({ hasText: 'Indiquez comment juger la réussite.' }),
  ).toBeVisible();
});

test('invalid input is reported before reaching the API', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/responsabilites/nouvelle');
  await page.getByLabel('Titre', { exact: true }).fill('Ok');
  await page.getByLabel('Début (facultatif)').fill('2026-12-10');
  await page.getByLabel('Fin (facultatif)').fill('2026-12-01');
  await page
    .getByRole('button', { name: 'Créer la responsabilité (brouillon)' })
    .click();
  await expect(page.getByText('Titre : au moins 3 caractères')).toBeVisible();
  await expect(
    page.getByText('La date de fin doit suivre la date de début'),
  ).toBeVisible();
});

test('members read responsibilities without editing them', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'moussa', baseURL!);
  await page.goto('/espace/responsabilites');
  await expect(
    page.getByRole('link', { name: 'Nouvelle responsabilité' }),
  ).toHaveCount(0);
  await page.getByRole('link', { name: 'Relance des devis clients' }).click();
  await expect(page.getByRole('region', { name: 'Modifier' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Suspendre' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Historique' })).toBeVisible();
});

test('responsibility pages never overflow horizontally', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  for (const path of [
    '/espace/responsabilites',
    '/espace/responsabilites/nouvelle',
    responsibilityPath,
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole('main').getByRole('heading', { level: 1 }),
    ).toBeVisible();
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
