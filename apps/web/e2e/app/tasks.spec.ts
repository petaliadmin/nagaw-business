import { expect, test, type Page } from '@playwright/test';
import { resetBackend, signInAs } from '../support/session';

test.describe.configure({ mode: 'serial' });

let taskPath: string;

test.beforeAll(async () => {
  await resetBackend();
});

async function createActiveResponsibility(page: Page) {
  await page.goto('/espace/responsabilites/nouvelle');
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
    .getByLabel('Personne à prévenir en cas de blocage')
    .selectOption({ label: 'awa@acme.test' });
  await page
    .getByRole('button', { name: 'Créer la responsabilité (brouillon)' })
    .click();
  await page.getByRole('button', { name: 'Activer' }).click();
  await expect(
    page.getByRole('main').getByText('Active', { exact: true }),
  ).toBeVisible();
}

test('owner launches a task from an active responsibility', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await createActiveResponsibility(page);
  const tasks = page.getByRole('region', { name: 'Tâches' });
  await expect(tasks).toContainText('0 / 4 tâches lancées aujourd’hui.');
  await tasks.getByRole('link', { name: 'Lancer une tâche' }).click();

  await expect(page.getByLabel('Responsabilité')).toHaveValue(/.+/);
  await expect(page.getByLabel('Personne en charge')).toHaveValue(
    'aaaaaaaa-0000-4000-8000-000000000002',
  );
  await page
    .getByLabel('Titre', { exact: true })
    .fill('Relancer les devis de la semaine');
  await page.getByLabel('Échéance (facultatif)').fill('2026-01-05');
  await page.getByRole('button', { name: 'Lancer la tâche' }).click();

  const main = page.getByRole('main');
  await expect(
    main.getByRole('heading', {
      level: 1,
      name: 'Relancer les devis de la semaine',
    }),
  ).toBeVisible();
  taskPath = new URL(page.url()).pathname;
  await expect(main.getByText('À faire', { exact: true })).toBeVisible();
  await expect(main.getByText('En retard', { exact: true })).toBeVisible();
  const summary = page.getByRole('region', { name: 'Résumé' });
  await expect(summary).toContainText('En chargemoussa@acme.test');
  await expect(
    summary.getByRole('link', { name: 'Relance des devis' }),
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Historique' })).toContainText(
    'Tâche lancée — awa@acme.test',
  );
});

test('the person in charge works the task through to the end', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'moussa', baseURL!);
  await page.goto('/espace/taches');
  await page
    .getByRole('list', { name: 'Liste des tâches' })
    .getByRole('link', { name: 'Relancer les devis de la semaine' })
    .click();
  await expect(page.getByRole('region', { name: 'Modifier' })).toHaveCount(0);

  const progress = page.getByRole('region', { name: 'Avancement' });
  await progress.getByRole('button', { name: 'Démarrer' }).click();
  await expect(
    page.getByRole('main').getByText('En cours', { exact: true }),
  ).toBeVisible();

  const notes = page.getByRole('region', { name: 'Notes' });
  await notes.getByLabel('Nouvelle note').fill('Trois clients appelés.');
  await notes.getByRole('button', { name: 'Ajouter la note' }).click();
  await expect(notes.getByRole('listitem')).toContainText(
    'Trois clients appelés.',
  );
  await expect(notes.getByLabel('Nouvelle note')).toHaveValue('');

  await progress
    .getByLabel('Motif du blocage')
    .fill('Le fichier des devis est introuvable.');
  await progress.getByRole('button', { name: 'Signaler un blocage' }).click();
  await expect(
    page
      .getByRole('main')
      .getByRole('alert')
      .filter({ hasText: 'Bloquée : Le fichier des devis est introuvable.' }),
  ).toContainText('Personne à prévenir : awa@acme.test.');

  await progress.getByRole('button', { name: 'Reprendre' }).click();
  await expect(
    page.getByRole('main').getByText('En cours', { exact: true }),
  ).toBeVisible();

  await progress.getByRole('button', { name: 'Terminer' }).click();
  await expect(
    progress.getByText('Compte rendu : au moins 3 caractères'),
  ).toBeVisible();
  await progress
    .getByLabel('Résultat')
    .selectOption({ label: 'Partiellement atteint' });
  await progress
    .getByLabel('Compte rendu')
    .fill('Deux devis relancés sur trois.');
  await progress.getByRole('button', { name: 'Terminer' }).click();

  const main = page.getByRole('main');
  await expect(main.getByText('Terminée', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Avancement' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Résumé' })).toContainText(
    'RésultatPartiellement atteint',
  );
  await expect(page.getByRole('region', { name: 'Historique' })).toContainText(
    'En cours → Bloquée (Le fichier des devis est introuvable.)',
  );
});

test('a member launches a one-off task only for themself', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'moussa', baseURL!);
  await page.goto('/espace/taches/nouvelle');
  const assignee = page.getByLabel('Personne en charge');
  await expect(assignee.getByRole('option')).toHaveText(['moussa@acme.test']);
  await page
    .getByLabel('Titre', { exact: true })
    .fill('Préparer la réunion de lundi');
  await page.getByRole('button', { name: 'Lancer la tâche' }).click();
  await expect(page.getByRole('region', { name: 'Résumé' })).toContainText(
    'ResponsabilitéTâche ponctuelle',
  );
});

test('owner follows the team, edits and cancels a task', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace');
  const figures = page.getByRole('region', { name: 'Tâches' });
  await expect(figures.locator('dd')).toHaveText(['0', '0', '0', '0']);

  await page.goto('/espace/taches');
  await expect(page.getByText('Aucune tâche à traiter')).toBeVisible();
  await page.getByRole('link', { name: 'Toute l’équipe' }).click();
  const list = page.getByRole('list', { name: 'Liste des tâches' });
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await expect(list).toContainText('Préparer la réunion de lundi');
  await page.getByRole('link', { name: 'Clôturées' }).click();
  await expect(list).toContainText('Relancer les devis de la semaine');

  await page.goto('/espace/taches');
  await page.getByRole('link', { name: 'Toute l’équipe' }).click();
  await list
    .getByRole('link', { name: 'Préparer la réunion de lundi' })
    .click();
  const edit = page.getByRole('region', { name: 'Modifier' });
  await edit
    .getByLabel('Titre', { exact: true })
    .fill('Préparer la réunion de mardi');
  await edit.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(edit.getByText('Tâche enregistrée.')).toBeVisible();

  const progress = page.getByRole('region', { name: 'Avancement' });
  await progress
    .getByLabel('Motif de l’annulation (facultatif)')
    .fill('Réunion reportée.');
  await progress.getByLabel('Annulation définitive').check();
  await progress.getByRole('button', { name: 'Annuler la tâche' }).click();
  await expect(
    page.getByRole('main').getByText('Annulée', { exact: true }),
  ).toBeVisible();
  const history = page.getByRole('region', { name: 'Historique' });
  await expect(history).toContainText('Tâche modifiée');
  await expect(history).toContainText('À faire → Annulée (Réunion reportée.)');
});

test('task pages never overflow horizontally', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  for (const path of [
    '/espace/taches?vue=toutes&statut=closes',
    '/espace/taches/nouvelle',
    taskPath,
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
