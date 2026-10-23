import { expect, test } from '@playwright/test';
import { resetBackend, signInAs } from '../support/session';

test.describe.configure({ mode: 'serial' });

let agentPath: string;

test.beforeAll(async () => {
  await resetBackend();
});

test('owner creates a draft agent; the controlled test blocks activation', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/agents');
  await expect(page.getByText('Aucun agent pour le moment')).toBeVisible();
  await page.getByRole('link', { name: 'Nouvel agent' }).click();

  await page.getByLabel('Nom', { exact: true }).fill('Agent commercial');
  await page
    .getByLabel('Domaine', { exact: true })
    .selectOption({ label: 'Commercial' });
  await page
    .getByLabel('Objectifs', { exact: true })
    .fill('Aucun devis sans suivi.');
  await page.getByLabel('Instructions', { exact: true }).fill('À compléter');
  await expect(
    page.getByRole('checkbox', {
      name: /Envoyer un e-mail — bientôt disponible/,
    }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Créer l’agent (brouillon)' }).click();

  const main = page.getByRole('main');
  await expect(
    main.getByRole('heading', { level: 1, name: 'Agent commercial' }),
  ).toBeVisible();
  await expect(main.getByText('Brouillon', { exact: true })).toBeVisible();
  agentPath = new URL(page.url()).pathname;

  await page.getByRole('button', { name: 'Lancer le test contrôlé' }).click();
  const report = page.getByRole('region', { name: 'Résultat du test' });
  await expect(report).toContainText(
    'Version 1 : incomplète, l’activation est bloquée.',
  );
  await expect(report).toContainText(
    'Bloquant : Les instructions doivent contenir au moins 20 caractères.',
  );
  await expect(report).toContainText('Aucun modèle d’IA n’est configuré');

  await page.getByRole('button', { name: 'Activer' }).click();
  await expect(
    main.getByRole('alert').filter({ hasText: 'incomplète' }),
  ).toBeVisible();
});

test('a new configuration creates version 2, then the agent is activated', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto(agentPath);
  const configuration = page.getByRole('region', { name: 'Configuration' });
  await configuration
    .getByLabel('Instructions', { exact: true })
    .fill('Relancer chaque devis resté sans réponse depuis sept jours.');
  await configuration
    .getByRole('button', { name: 'Enregistrer une nouvelle version' })
    .click();
  await expect(
    configuration.getByText('Configuration enregistrée (version 2).'),
  ).toBeVisible();

  const history = page.getByRole('region', { name: 'Historique des versions' });
  await expect(history).toContainText('Version 2 (actuelle)');
  await expect(history).toContainText('Version 1');

  await page.getByRole('button', { name: 'Lancer le test contrôlé' }).click();
  await expect(
    page.getByRole('region', { name: 'Résultat du test' }),
  ).toContainText('Version 2 : prête à être activée.');

  await page.getByRole('button', { name: 'Activer' }).click();
  const main = page.getByRole('main');
  await expect(main.getByText('Actif', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Suspendre' })).toBeVisible();

  await page.goto('/espace');
  const summary = page.getByRole('region', { name: 'Votre organisation' });
  await expect(summary.getByText('Agents actifs')).toBeVisible();
  await expect(summary.locator('dd').nth(1)).toHaveText('1');
});

test('members read agents and run the test, without editing', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'moussa', baseURL!);
  await page.goto('/espace/agents');
  await expect(page.getByRole('link', { name: 'Nouvel agent' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Agent commercial' }).click();
  await expect(page.getByRole('region', { name: 'Configuration' })).toHaveCount(
    0,
  );
  await expect(page.getByRole('button', { name: 'Suspendre' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Lancer le test contrôlé' }).click();
  await expect(
    page.getByRole('region', { name: 'Résultat du test' }),
  ).toBeVisible();
});

test('another organization never sees the agent', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  // Awa's active organization becomes Globex, where the agent does not exist.
  await context.addCookies([
    {
      name: 'nagaw_org',
      value: '22222222-2222-4222-8222-222222222222',
      url: baseURL!,
    },
  ]);
  await page.goto(agentPath);
  await expect(page.getByRole('main').getByRole('alert')).toHaveText(
    'Cet agent n’existe pas dans cette organisation.',
  );
  await page.goto('/espace/agents');
  await expect(page.getByText('Aucun agent pour le moment')).toBeVisible();
});

test('archiving is confirmed, final, and hides the agent', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto(agentPath);
  await page.getByLabel('Archivage définitif').check();
  await page.getByRole('button', { name: 'Archiver' }).click();
  const main = page.getByRole('main');
  await expect(main.getByText('Archivé', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Activer' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Configuration' })).toHaveCount(
    0,
  );

  await page.goto('/espace/agents');
  await expect(page.getByText('Aucun agent pour le moment')).toBeVisible();
  await page
    .getByRole('link', { name: 'Afficher les agents archivés' })
    .click();
  await expect(
    page.getByRole('list', { name: 'Liste des agents' }),
  ).toContainText('Agent commercial');
});

test('agent pages never overflow horizontally', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  for (const path of ['/espace/agents', '/espace/agents/nouveau', agentPath]) {
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
