import { expect, test, type Page } from '@playwright/test';
import { resetBackend, signInAs } from '../support/session';

test.describe.configure({ mode: 'serial' });

test.beforeEach(async () => {
  await resetBackend();
});

async function addToCart(page: Page, name: string, times = 1) {
  const tile = page
    .getByRole('list', { name: 'Produits à vendre' })
    .getByRole('button', { name: new RegExp(`^Ajouter ${name}`) });
  for (let i = 0; i < times; i++) await tile.click();
}

async function openPayment(page: Page, isMobile: boolean) {
  if (isMobile) await page.getByRole('button', { name: /^Encaisser/ }).click();
  await expect(page.getByRole('heading', { name: 'Paiement' })).toBeVisible();
}

test('a seller corrects the stock at the counter, then sells', async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  await signInAs(context, 'moussa', baseURL!);
  await page.goto('/caisse');
  // The soap has no stock recorded: the counter says so.
  await addToCart(page, 'Savon de Marseille', 2);
  await openPayment(page, isMobile);
  const cart = page.getByRole('list', { name: 'Articles du panier' });
  await expect(cart.getByText(/^Stock insuffisant/)).toContainText(
    '2 pièces dans le panier, 0 pièce en stock',
  );
  await expect(
    page.getByRole('button', { name: /^Vendre quand même/ }),
  ).toBeVisible();

  await cart.getByRole('button', { name: 'Corriger le stock' }).click();
  await cart.getByLabel(/^Combien y en a-t-il vraiment en rayon/).fill('500');
  await cart.getByRole('button', { name: 'Enregistrer le stock' }).click();
  // Beyond the shop's limit (20 by default), a seller is refused.
  await expect(cart.getByText(/plus de 20 doit être faite/)).toBeVisible();

  await cart.getByLabel(/^Combien y en a-t-il vraiment en rayon/).fill('5');
  await cart.getByRole('button', { name: 'Enregistrer le stock' }).click();
  await expect(cart.getByText(/^Stock insuffisant/)).toHaveCount(0);
  await page.getByRole('button', { name: /^Valider la vente/ }).click();
  await expect(page).toHaveURL(/\/espace\/ventes\/[^/?]+\?nouvelle=1$/);
  // Corrected before the sale: the sale is not flagged.
  await expect(page.getByText(/^Stock à vérifier/)).toHaveCount(0);

  // 5 counted, 2 sold: 3 left, as the owner sees it.
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/produits/dddddddd-0000-4000-8000-000000000002');
  await expect(page.getByText(/Recompté en rayon/)).toBeVisible();
});

test('a sale beyond the stock goes through, flagged for the manager', async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  await signInAs(context, 'moussa', baseURL!);
  await page.goto('/caisse');
  await addToCart(page, 'Savon de Marseille');
  await openPayment(page, isMobile);
  await page.getByRole('button', { name: /^Vendre quand même/ }).click();
  await expect(page).toHaveURL(/\/espace\/ventes\/[^/?]+\?nouvelle=1$/);
  await expect(page.getByText(/^Stock à vérifier/)).toBeVisible();
});

test('sellers record deliveries, not losses', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'moussa', baseURL!);
  await page.goto('/espace/produits/dddddddd-0000-4000-8000-000000000002');
  await expect(page.getByText('J’ai reçu de la marchandise')).toBeVisible();
  await expect(page.getByText('Perte, casse ou produit abîmé')).toHaveCount(0);
  await expect(
    page.getByText('J’ai compté ce qui reste (inventaire)'),
  ).toHaveCount(0);
});

test('each person chooses what they receive, within their role', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace');
  await page
    .getByRole('link', { name: /^Notifications/ })
    .first()
    .click();
  await expect(
    page.getByRole('heading', { name: 'Notifications', level: 1 }),
  ).toBeVisible();
  await expect(page.getByText('Rien de nouveau')).toBeVisible();

  await page.getByRole('link', { name: 'Ce que je reçois' }).click();
  // Push is not configured on this server: said plainly.
  await expect(
    page.getByText(/pas encore activées pour Nagaw Business/),
  ).toBeVisible();
  const summary = page.getByRole('checkbox', { name: /^Résumé du soir/ });
  await expect(summary).toBeChecked();
  await summary.uncheck();
  await page.getByRole('button', { name: 'Enregistrer mes choix' }).click();
  await expect(page.getByText('Vos choix sont enregistrés.')).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('checkbox', { name: /^Résumé du soir/ }),
  ).not.toBeChecked();

  // A seller only hears about the stock.
  await signInAs(context, 'moussa', baseURL!);
  await page.goto('/espace/notifications/reglages');
  await expect(page.getByRole('checkbox', { name: /^Stock/ })).toBeVisible();
  await expect(
    page.getByRole('checkbox', { name: /^Résumé du soir/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('checkbox', { name: /^Contrôles des ventes/ }),
  ).toHaveCount(0);
});

test('the owner sets the thresholds; sellers do not see them', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/parametres');
  const hour = page.getByLabel('Heure du résumé du soir');
  await expect(hour).toHaveValue('20');
  await hour.fill('30');
  await page.getByRole('button', { name: 'Enregistrer les réglages' }).click();
  await expect(page.getByText(/Au plus 23 h/)).toBeVisible();
  await hour.fill('21');
  await page.getByRole('button', { name: 'Enregistrer les réglages' }).click();
  await expect(page.getByText('Réglages enregistrés.')).toBeVisible();

  await signInAs(context, 'moussa', baseURL!);
  await page.goto('/espace/parametres');
  await expect(
    page.getByRole('heading', { name: 'Alertes et stock' }),
  ).toHaveCount(0);
});

test('a seller sees their own figures on the dashboard', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'moussa', baseURL!);
  await page.goto('/espace');
  await expect(page.getByRole('heading', { name: 'Mes ventes' })).toBeVisible();
  await expect(page.getByText('Ces 7 derniers jours')).toBeVisible();
});
