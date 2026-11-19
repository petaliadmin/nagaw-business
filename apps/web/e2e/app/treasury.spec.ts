import { expect, test, type Page } from '@playwright/test';
import { expectAccessible } from '../support/a11y';
import { resetBackend, signInAs } from '../support/session';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await resetBackend();
});

const plain = (text: string | null) => (text ?? '').replace(/[  ]/g, ' ');

async function sellWater(page: Page, isMobile: boolean) {
  await page.goto('/espace/vendre');
  await page
    .getByRole('list', { name: 'Produits à vendre' })
    .getByRole('button', { name: /^Ajouter Eau minérale 1,5 L/ })
    .click();
  if (isMobile) await page.getByRole('button', { name: /^Encaisser/ }).click();
  await page.getByRole('button', { name: /^Valider la vente/ }).click();
  await expect(page.getByText('Vente enregistrée.')).toBeVisible();
}

const accountBalance = (page: Page, name: string) =>
  page
    .getByRole('list', { name: 'Caisses' })
    .getByRole('link', { name: new RegExp(`^${name}`) });

test('a cash sale shows in the statistics and in the drawer', async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await sellWater(page, isMobile);

  await page.goto('/espace/statistiques');
  const main = page.getByRole('region', { name: 'L’essentiel' });
  expect(plain(await main.textContent())).toContain(
    'Chiffre d’affaires500 F CFA',
  );
  expect(plain(await main.textContent())).toContain('Nombre de ventes1');
  await expect(
    page.getByRole('list', { name: 'Les plus vendus' }),
  ).toContainText('Eau minérale 1,5 L');
  await page.getByText('Voir les chiffres en tableau').click();
  await expect(
    page.getByRole('table', { name: /Chiffre d’affaires/ }),
  ).toBeVisible();
  await expectAccessible(page, 'statistiques');

  await page.goto('/espace/tresorerie');
  expect(plain(await accountBalance(page, 'Caisse').textContent())).toContain(
    '500 F CFA',
  );
  await expect(accountBalance(page, 'Wave')).toHaveCount(0); // still empty
  await page.getByRole('link', { name: /autres caisses/ }).click();
  await expect(accountBalance(page, 'Wave')).toBeVisible();
});

// Uses the sale of the first test (serial file, shared backend).
test('the home page shows the essentials of the period', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  const essentials = async () =>
    plain(
      await page.getByRole('region', { name: 'L’essentiel' }).textContent(),
    );
  const salesCount = (text: string) =>
    Number(/Nombre de ventes(\d+)/.exec(text)?.[1]);
  await page.goto('/espace');
  expect(await essentials()).toContain('Chiffre d’affaires'); // this month
  // The period is one pill on the dark card; it opens the others.
  const period = page.getByRole('button', { name: 'Période : Ce mois' });
  await expect(period).toHaveAttribute('aria-expanded', 'false');
  await period.click();
  await page
    .getByRole('list', { name: 'Période' })
    .getByRole('link', { name: 'Aujourd’hui' })
    .click();
  await expect(page).toHaveURL(/periode=jour/);
  await expect(
    page.getByRole('button', { name: 'Période : Aujourd’hui' }),
  ).toBeVisible();
  const text = await essentials();
  expect(salesCount(text)).toBeGreaterThanOrEqual(1);
  expect(text).toMatch(/Panier moyen[\d ]+ F CFA/);
  expect(text).toContain('Comparé à la période d’avant');
  await expect(
    page.getByRole('list', { name: 'Ce qui rapporte le plus' }),
  ).toContainText('Eau minérale 1,5 L');
  await expect(
    page.getByRole('list', { name: 'Paiements par moyen' }),
  ).toContainText('Espèces');
  await expectAccessible(page, 'tableau de bord');
});

test('the expense steps ask for what is missing, and go back', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/tresorerie/depenses/nouvelle');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page.getByText('Tapez le montant payé.')).toBeVisible();
  await expect(page.getByText('Étape 1 sur 3')).toBeVisible();
  await page.getByRole('button', { name: '5', exact: true }).click();
  await page.getByRole('button', { name: '0', exact: true }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(
    page.getByText('Choisissez pour quoi vous avez payé.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Retour' }).click();
  await expect(page.getByLabel('Montant', { exact: true })).toHaveValue('50');
});

test('an expense lowers the drawer until it is cancelled', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/tresorerie/depenses/nouvelle');
  // Three steps (ADR-063): how much, what for, paid with what.
  await expect(page.getByText('Étape 1 sur 3')).toBeVisible();
  await page.getByLabel('Montant', { exact: true }).fill('200');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page.getByText('Étape 2 sur 3')).toBeVisible();
  await page.locator('label', { hasText: /^Autres dépenses$/ }).click();
  await expect(
    page.getByRole('radio', { name: 'Autres dépenses' }),
  ).toBeChecked();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page.getByText('Étape 3 sur 3')).toBeVisible();
  await page.locator('summary', { hasText: 'Détail et date' }).click();
  await page.getByLabel('Ce qui a été payé').fill('Ticket de bus');
  await page.getByRole('button', { name: 'Enregistrer la dépense' }).click();
  await expect(page.getByText('Dépense enregistrée.')).toBeVisible();
  const list = page.getByRole('list', { name: 'Liste des dépenses' });
  await expect(list).toContainText('Ticket de bus');
  await expectAccessible(page, 'dépenses');

  await page.goto('/espace/tresorerie');
  expect(plain(await accountBalance(page, 'Caisse').textContent())).toContain(
    '300 F CFA',
  );

  await page.goto('/espace/tresorerie/depenses');
  await page.getByText('Annuler cette dépense').click();
  await page.getByLabel('Pourquoi annuler « Ticket de bus » ?').fill('Erreur');
  await page.getByRole('button', { name: 'Annuler la dépense' }).click();
  await expect(page.getByText('Annulée', { exact: true })).toBeVisible();
  await page.goto('/espace/tresorerie');
  expect(plain(await accountBalance(page, 'Caisse').textContent())).toContain(
    '500 F CFA',
  );
});

test('money moved to the bank stays in the shop', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/tresorerie');
  const card = page.getByRole('region', { name: 'Déplacer de l’argent' });
  // Folded until asked for: the balances come first.
  await card.locator('summary').click();
  await card.getByLabel('Sortir de').selectOption({ label: 'Caisse' });
  await card.getByLabel('Mettre dans').selectOption({ label: 'Banque' });
  await card.getByLabel('Montant').fill('100');
  await card.getByRole('button', { name: 'Déplacer l’argent' }).click();
  await expect(card.getByText('Argent déplacé.')).toBeVisible();
  expect(plain(await accountBalance(page, 'Caisse').textContent())).toContain(
    '400 F CFA',
  );
  expect(plain(await accountBalance(page, 'Banque').textContent())).toContain(
    '100 F CFA',
  );
  expect(
    plain(
      await page
        .getByRole('region', { name: 'Total de la trésorerie' })
        .textContent(),
    ),
  ).toContain('500 F CFA');
});

test('counting the drawer tells what is missing and closes the day', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/tresorerie');
  await page.getByRole('link', { name: 'Clôturer la journée' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Clôturer la journée' }),
  ).toBeVisible();
  await expectAccessible(page, 'clôture');
  await page.getByLabel('Caisse : ce que vous avez compté').fill('350');
  await expect(page.getByText(/Il manque 50/)).toBeVisible();
  await page.getByRole('button', { name: 'Clôturer la journée' }).click();
  // The drawer then shows the day as counted, instead of its field.
  await expect(
    page.getByText(/Journée clôturée par .*il manquait 50/),
  ).toBeVisible();
  await expect(page.getByLabel('Caisse : ce que vous avez compté')).toHaveCount(
    0,
  );
  await page.reload();
  await expect(
    page.getByText(/Journée clôturée par .*il manquait 50/),
  ).toBeVisible();

  await page
    .getByRole('link', { name: /Voir les entrées et sorties de Caisse/ })
    .click();
  await expect(
    page.getByRole('list', { name: 'Entrées et sorties' }),
  ).toContainText('Écart de clôture');
  await expect(page.getByLabel('Argent déjà là au départ')).toHaveCount(0);
  await expectAccessible(page, 'caisse');
});

test('a seller sees neither the money nor the statistics', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'moussa', baseURL!);
  await page.goto('/espace');
  await expect(page.getByRole('link', { name: 'Trésorerie' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Statistiques' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'L’essentiel' })).toHaveCount(
    0,
  );
  await page.goto('/espace/tresorerie');
  await expect(
    page.getByText('Votre rôle ne donne pas accès à l’argent de la boutique.'),
  ).toBeVisible();
});
