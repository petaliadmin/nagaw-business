import { expect, test } from '@playwright/test';
import { expectAccessible } from '../support/a11y';
import { resetBackend, signInAs } from '../support/session';

test.beforeAll(async () => {
  await resetBackend();
});

// One test per page: a failure names the page at once.
const PAGES = [
  '/espace',
  '/espace/equipe',
  '/espace/journal',
  '/espace/parametres',
  '/espace/nouvelle-boutique',
  '/espace/produits',
  '/espace/produits/nouveau',
  '/espace/produits/dddddddd-0000-4000-8000-000000000001',
  '/espace/produits/categories',
  '/espace/produits/fournisseurs',
  '/espace/vendre',
  '/espace/ventes',
  '/espace/clients',
  '/espace/clients/eeeeeeee-0000-4000-8000-000000000001',
  '/espace/factures',
  '/espace/factures?type=devis',
  '/espace/factures/nouvelle',
  '/espace/factures/devis/nouveau',
  '/espace/statistiques',
  '/espace/tresorerie',
  '/espace/tresorerie/depenses',
  '/espace/tresorerie/cloture',
  '/espace/comptabilite',
  '/espace/comptabilite?vue=etat',
];

for (const path of PAGES) {
  test(`${path} meets WCAG 2.2 AA (no serious violation)`, async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, 'awa', baseURL!);
    await page.goto(path);
    await expect(
      page.getByRole('main').getByRole('heading', { level: 1 }),
    ).toBeVisible();
    await expectAccessible(page, path);
  });
}

test('the « Plus » sheet meets WCAG 2.2 AA', async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  test.skip(!isMobile, 'Mobile-only sheet');
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace');
  await page.getByRole('button', { name: 'Plus' }).click();
  await expect(page.getByRole('dialog', { name: 'Plus' })).toBeVisible();
  await expectAccessible(page, 'menu « Plus »');
});
