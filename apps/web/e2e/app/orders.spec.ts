import { expect, test } from '@playwright/test';
import { expectAccessible } from '../support/a11y';
import { resetBackend, signInAs } from '../support/session';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await resetBackend();
});

const plain = (text: string | null) => (text ?? '').replace(/\s/g, ' ');

test('orders stay off until the owner turns them on (ADR-072)', async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace');
  const shortcuts = page.getByRole('navigation', { name: 'Raccourcis' });
  await expect(shortcuts.getByRole('link', { name: /^Commandes/ })).toHaveCount(
    0,
  );

  await page.goto('/espace/parametres?partie=application');
  await page.waitForLoadState('networkidle');
  const shop = page.getByRole('region', { name: 'Mon application' });
  await shop.getByRole('checkbox', { name: 'Commandes' }).check();
  await shop.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(shop.getByText('Enregistré.')).toBeVisible();

  await page.goto('/espace');
  await expect(
    shortcuts.getByRole('link', { name: /^Commandes/ }),
  ).toBeVisible();
  // In the Menu, never in the bottom bar.
  if (isMobile) {
    await expect(
      page
        .getByRole('navigation', { name: 'Navigation principale' })
        .getByRole('link', { name: 'Commandes' }),
    ).toHaveCount(0);
    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(
      page.getByRole('dialog', { name: 'Menu' }).getByRole('link', {
        name: 'Commandes',
      }),
    ).toBeVisible();
  } else {
    await expect(
      page
        .getByRole('complementary', { name: 'Barre latérale' })
        .getByRole('link', { name: 'Commandes' }),
    ).toBeVisible();
  }
});

test('an order is taken with a deposit, moves on, and is handed over as a sale', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/commandes');
  await page.getByRole('link', { name: 'Nouvelle commande' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Nouvelle commande' }),
  ).toBeVisible();
  await expectAccessible(page, 'Nouvelle commande');

  await page.getByLabel('Client', { exact: true }).selectOption({
    label: 'Fatou Ndiaye — 77 111 22 33',
  });
  await page.getByLabel('Article 1', { exact: true }).selectOption({
    label: 'Eau minérale 1,5 L — 500 F CFA',
  });
  await page.getByLabel('Quantité').first().fill('2');
  await page.getByRole('button', { name: 'Ajouter un article' }).click();
  await page
    .getByLabel('Article 2', { exact: true })
    .selectOption({ label: 'Sur mesure (autre article)' });
  await page.getByLabel('Nom de l’article').fill('Gâteau au chocolat');
  await page.getByLabel('Prix de la ligne').fill('5000');
  await page.getByLabel('Note (facultatif)').nth(1).fill('Joyeux anniversaire');
  await page.getByText('Livraison', { exact: true }).click();
  await page.getByLabel('Adresse ou quartier').fill('Sacré-Cœur 3');
  await page.getByLabel('Frais de livraison (facultatif)').fill('500');
  await page.getByLabel('Le client paie maintenant').fill('2000');
  await expect(page.locator('dl').last()).toContainText(
    /Reste à payer\s*4\s500/,
  );
  await page.getByRole('button', { name: 'Enregistrer la commande' }).click();

  await expect(
    page.getByRole('heading', { level: 1, name: /^Commande C-\d{4}-0001/ }),
  ).toBeVisible();
  const lines = page.getByRole('region', { name: 'Articles' });
  await expect(lines).toContainText('Gâteau au chocolat');
  await expect(lines).toContainText('Joyeux anniversaire');
  expect(plain(await lines.textContent())).toContain(
    'Reste à payer4 500 F CFA',
  );
  await expectAccessible(page, 'Commande');

  await page
    .getByRole('group', { name: 'Étape' })
    .getByRole('button', { name: 'Prête' })
    .click();
  await expect(
    page.getByRole('group', { name: 'Étape' }).getByRole('button', {
      name: 'Prête',
    }),
  ).toHaveAttribute('aria-pressed', 'true');

  const deposit = page.getByRole('region', { name: 'Recevoir une avance' });
  await deposit.getByLabel('Montant reçu').fill('1000');
  await deposit.getByRole('button', { name: 'Enregistrer l’avance' }).click();
  await expect(page.getByText('Avance enregistrée.')).toBeVisible();
  expect(plain(await lines.textContent())).toContain(
    'Reste à payer3 500 F CFA',
  );

  const handover = page.getByRole('region', { name: 'Remettre au client' });
  await expect(handover).toContainText('À encaisser : 3 500');
  await handover.getByRole('button', { name: 'Remettre au client' }).click();
  await expect(page).toHaveURL(/\/espace\/ventes\//);
  await expect(
    page.getByRole('heading', { level: 1, name: /^Ticket n°/ }),
  ).toBeVisible();
  await expect(
    page.locator('p').filter({ hasText: /^Commande C-\d{4}-0001$/ }),
  ).toBeVisible();
  await expect(page.getByText('Avance, Espèces').first()).toBeVisible();

  await page.goto('/espace/commandes?vue=terminees');
  await expect(page.getByRole('link', { name: /Fatou Ndiaye/ })).toContainText(
    'Remise',
  );
});

test('the owner cancels an order and gives the deposit back', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/commandes/nouvelle');
  await page.getByLabel('Client', { exact: true }).selectOption({
    label: 'Fatou Ndiaye — 77 111 22 33',
  });
  await page.getByLabel('Le client paie maintenant').fill('500');
  await page.getByRole('button', { name: 'Enregistrer la commande' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: /^Commande C-/ }),
  ).toBeVisible();
  await page.getByText('Annuler cette commande', { exact: true }).click();
  await page.getByLabel('Pourquoi ?').fill('Le client a changé d’avis');
  await expect(page.getByText(/À rendre au client : 500/)).toBeVisible();
  await page.getByRole('button', { name: 'Annuler la commande' }).click();
  await expect(
    page.getByText(/Annulée le .*Le client a changé d’avis/),
  ).toBeVisible();
  await expect(
    page.getByText('Rendue · Espèces', { exact: false }),
  ).toBeVisible();
});
