import { expect, test } from '@playwright/test';
import { expectAccessible } from '../support/a11y';
import { resetBackend, signInAs } from '../support/session';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await resetBackend();
});

test('the owner sees the offer, its limits, and asks for another one', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/abonnement');
  await expect(
    page.getByRole('heading', { level: 2, name: 'Offre Pro' }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'Offre Pro' })
      .getByText('2 (sans limite)', { exact: true }),
  ).toBeVisible();
  const offers = page.getByRole('list', { name: 'Les offres' });
  await expect(
    offers.getByRole('listitem', { name: 'Offre Gratuit' }),
  ).toContainText('3 produits');
  await expect(
    offers.getByRole('listitem', { name: 'Offre Essentiel' }),
  ).toContainText('10 produits');
  const pro = offers.getByRole('listitem', { name: 'Offre Pro' });
  await expect(pro).toContainText('Votre offre');
  await expect(pro).toContainText('Produits sans limite');
  await expectAccessible(page, 'abonnement');

  await offers
    .getByRole('button', { name: 'Demander l’offre Essentiel' })
    .click();
  await expect(
    page.getByText(/Demande de passage à l’offre Essentiel envoyée/),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /^Demander l’offre/ }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Annuler la demande' }).click();
  await expect(
    page.getByRole('button', { name: 'Demander l’offre Essentiel' }),
  ).toBeVisible();
});

test('a seller sees nothing of the subscription', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'moussa', baseURL!);
  await page.goto('/espace');
  await expect(page.getByRole('link', { name: 'Abonnement' })).toHaveCount(0);
  await page.goto('/espace/abonnement');
  await expect(
    page.getByText(
      'Seuls le propriétaire et les gérants voient l’abonnement de la boutique.',
    ),
  ).toBeVisible();
});
