import { expect, test } from '@playwright/test';
import { expectAccessible } from '../support/a11y';
import { resetBackend, signInAs } from '../support/session';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await resetBackend();
});

test('a seller tells the platform about a problem and reads its answer', async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  await signInAs(context, 'moussa', baseURL!);
  await page.goto('/espace/produits');
  if (isMobile) await page.getByRole('button', { name: 'Plus' }).click();
  await page.getByRole('link', { name: 'Donner mon avis' }).first().click();
  await expect(page).toHaveURL(/\/espace\/avis\?depuis=%2Fespace%2Fproduits$/);
  await expectAccessible(page, 'avis');
  await page
    .getByLabel('Votre message')
    .fill('La photo du produit ne s’affiche pas.');
  await page.getByRole('button', { name: 'Envoyer' }).click();
  await expect(
    page.getByText('Merci ! Votre message est envoyé à l’équipe Nagaw.'),
  ).toBeVisible();
  const mine = page.getByRole('list', { name: 'Mes messages' });
  await expect(mine).toContainText('La photo du produit ne s’affiche pas.');
  await expect(mine).toContainText('Envoyé');

  await context.clearCookies();
  await signInAs(context, 'binta', baseURL!);
  await page.goto('/admin/avis');
  const list = page.getByRole('list', { name: 'Liste des avis' });
  await expect(list).toContainText('page /espace/produits');
  await expectAccessible(page, 'avis administration');
  await list
    .getByLabel('Réponse à la boutique (facultatif)')
    .fill('Corrigé, merci !');
  await list.getByRole('button', { name: 'Répondre et clore' }).click();
  await expect(page.getByText('Aucun nouvel avis')).toBeVisible();

  await context.clearCookies();
  await signInAs(context, 'moussa', baseURL!);
  await page.goto('/espace/avis');
  await expect(page.getByRole('list', { name: 'Mes messages' })).toContainText(
    'Corrigé, merci !',
  );
});
