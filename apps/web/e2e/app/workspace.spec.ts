import { expect, test, type Page } from '@playwright/test';
import { resetBackend, signInAs } from '../support/session';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await resetBackend();
});

const IN_BOTTOM_BAR = ['Accueil', 'Vendre', 'Produits'];

/**
 * Desktop: the sidebar. Phones: the bottom bar, or the « Plus » sheet for
 * the other pages. Only one « Navigation principale » is visible at a time.
 */
async function navigate(page: Page, isMobile: boolean, label: string) {
  if (isMobile && !IN_BOTTOM_BAR.includes(label)) {
    await page.getByRole('button', { name: 'Plus' }).click();
    await page
      .getByRole('dialog', { name: 'Plus' })
      .getByRole('navigation', { name: 'Autres pages' })
      .getByRole('link', { name: label })
      .click();
    return;
  }
  await page
    .getByRole('navigation', { name: 'Navigation principale' })
    .getByRole('link', { name: label })
    .click();
}

/** Where the shop switcher lives: sidebar, or the « Plus » sheet. */
async function shopSwitcher(page: Page, isMobile: boolean) {
  if (!isMobile)
    return page.getByRole('complementary', { name: 'Barre latérale' });
  await page.getByRole('button', { name: 'Plus' }).click();
  return page.getByRole('dialog', { name: 'Plus' });
}

test('redirects to sign-in without a session', async ({ page }) => {
  await page.goto('/espace');
  await expect(page).toHaveURL(/\/connexion$/);
});

test('overview shows only real data for the active shop', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace');
  const main = page.getByRole('main');
  await expect(
    main.getByRole('heading', { level: 1, name: 'Acme Dakar' }),
  ).toBeVisible();
  await expect(main.getByText('Personnes dans l’équipe')).toBeVisible();
  await expect(
    main.getByRole('region', { name: 'Votre boutique' }).locator('dd').first(),
  ).toHaveText('2');
  await expect(main.getByText('Propriétaire')).toBeVisible();
  // Latest of the 27 audit entries comes first, with the author's e-mail.
  const activity = main.getByRole('region', { name: 'Activité récente' });
  await expect(activity.getByRole('listitem')).toHaveCount(5);
  await expect(activity.getByRole('listitem').first()).toContainText(
    'Paramètres de la boutique modifiés — awa@acme.test',
  );
  // Responsibilities and tasks are withdrawn (ADR-019).
  await expect(main.getByRole('region', { name: 'Tâches' })).toHaveCount(0);
  await expect(main.getByText(/responsabilit/i)).toHaveCount(0);
});

test('navigation reaches every section and marks the current page', async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace');

  await navigate(page, isMobile, 'Équipe');
  await expect(page).toHaveURL(/\/espace\/equipe$/);
  const members = page.getByRole('table', { name: 'Équipe de Acme Dakar' });
  await expect(members.getByRole('row')).toHaveCount(3);
  await expect(members).toContainText('moussa@acme.test');
  await expect(members).toContainText('Vendeur');

  await navigate(page, isMobile, 'Historique');
  await expect(page).toHaveURL(/\/espace\/journal$/);
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(26); // header + 25
  await page.getByRole('link', { name: 'Entrées plus anciennes' }).click();
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(3); // header + 2
  await expect(page.getByRole('table')).toContainText('Boutique créée');
  // The current page is marked where its link lives.
  if (isMobile) {
    await page.getByRole('button', { name: 'Plus' }).click();
    await expect(
      page
        .getByRole('dialog', { name: 'Plus' })
        .getByRole('link', { name: 'Historique' }),
    ).toHaveAttribute('aria-current', 'page');
    await page.keyboard.press('Escape');
  } else {
    await expect(
      page
        .getByRole('navigation', { name: 'Navigation principale' })
        .getByRole('link', { name: 'Historique' }),
    ).toHaveAttribute('aria-current', 'page');
  }

  await navigate(page, isMobile, 'Paramètres');
  await expect(page).toHaveURL(/\/espace\/parametres$/);

  await navigate(page, isMobile, 'Accueil');
  await expect(page).toHaveURL(/\/espace$/);
});

test('withdrawn modules are gone', async ({ page, context, baseURL }) => {
  await signInAs(context, 'awa', baseURL!);
  for (const path of ['/espace/responsabilites', '/espace/taches']) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
  }
});

test('owner updates the shop settings', async ({ page, context, baseURL }) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/parametres');
  await page.getByLabel('Nom de la boutique').fill('Acme Dakar SA');
  await page.getByLabel('Fuseau horaire').selectOption('Africa/Abidjan');
  const shop = page.getByRole('region', { name: 'Boutique' });
  await shop.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(
    shop.getByRole('status').filter({ hasText: 'Paramètres enregistrés.' }),
  ).toBeVisible();

  await page.goto('/espace');
  await expect(
    page
      .getByRole('main')
      .getByRole('heading', { level: 1, name: 'Acme Dakar SA' }),
  ).toBeVisible();

  // Restore for the next project sharing this backend.
  await resetBackend();
});

test('settings validate input before calling the API', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/parametres');
  await page.getByLabel('Nom de la boutique').fill('A');
  await page
    .getByRole('region', { name: 'Boutique' })
    .getByRole('button', { name: 'Enregistrer' })
    .click();
  await expect(
    page.getByText('Le nom doit contenir au moins 2 caractères'),
  ).toBeVisible();
});

test('switching shop changes data and permissions', async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace');
  const scope = await shopSwitcher(page, isMobile);
  await scope.getByLabel('Boutique').selectOption({ label: 'Globex Sénégal' });

  const main = page.getByRole('main');
  await expect(
    main.getByRole('heading', { level: 1, name: 'Globex Sénégal' }),
  ).toBeVisible();
  // Awa is a plain member of Globex: no audit access, read-only settings.
  await expect(
    main.getByText('Votre rôle ne donne pas accès à l’historique.'),
  ).toBeVisible();
  await page.goto('/espace/parametres');
  await expect(page.getByRole('button', { name: 'Enregistrer' })).toHaveCount(
    0,
  );
  await expect(
    page.getByText(
      'Seuls le propriétaire et les gérants peuvent modifier ces paramètres.',
    ),
  ).toBeVisible();
});

test('a forged organization cookie never opens another tenant', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await context.addCookies([
    {
      name: 'nagaw_org',
      value: '99999999-9999-4999-8999-999999999999',
      url: baseURL!,
    },
  ]);
  await page.goto('/espace');
  // Falls back to one of Awa's own organizations.
  await expect(
    page
      .getByRole('main')
      .getByRole('heading', { level: 1, name: 'Acme Dakar' }),
  ).toBeVisible();
});

test('a user without a shop is guided to create one', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'binta', baseURL!);
  await page.goto('/espace/equipe');
  await expect(
    page.getByRole('heading', { name: 'Créez votre boutique' }),
  ).toBeVisible();
  await page.getByLabel('Nom de la boutique').fill('Binta Conseil');
  await page.getByRole('button', { name: 'Créer la boutique' }).click();
  await expect(
    page
      .getByRole('main')
      .getByRole('heading', { level: 1, name: 'Binta Conseil' }),
  ).toBeVisible();
  await resetBackend();
});

test('an API failure is reported, not hidden', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'broken', baseURL!);
  await page.goto('/espace');
  await expect(
    page.getByRole('heading', { name: 'Espace indisponible' }),
  ).toBeVisible();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Une erreur interne est survenue.',
  );
});

test('phone navigation: bottom bar and a keyboard-friendly « Plus » sheet', async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  test.skip(!isMobile, 'Mobile-only behavior');
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace');
  await expect(
    page.getByRole('complementary', { name: 'Barre latérale' }),
  ).toBeHidden();
  const bar = page.getByRole('navigation', { name: 'Navigation principale' });
  await expect(bar.getByRole('link')).toHaveText(IN_BOTTOM_BAR);
  await expect(bar.getByRole('link', { name: 'Accueil' })).toHaveAttribute(
    'aria-current',
    'page',
  );

  const button = page.getByRole('button', { name: 'Plus' });
  await expect(button).toHaveAttribute('aria-expanded', 'false');
  await button.click();
  const dialog = page.getByRole('dialog', { name: 'Plus' });
  await expect(dialog).toBeVisible();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  await expect(dialog).toContainText('awa@acme.test');
  await expect(
    dialog.getByRole('button', { name: 'Se déconnecter' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(button).toBeFocused();
});

test('touch targets are at least 48 px high', async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(90_000); // three pages, every control measured
  await signInAs(context, 'awa', baseURL!);
  for (const path of ['/espace', '/espace/equipe', '/espace/parametres']) {
    await page.goto(path);
    await expect(
      page.getByRole('main').getByRole('heading', { level: 1 }),
    ).toBeVisible();
    const small = await page.evaluate(() =>
      [
        ...document.querySelectorAll(
          'a, button, select, input:not([type=hidden])',
        ),
      ]
        .filter((el) => {
          const box = el.getBoundingClientRect();
          // Visible controls only. Exempt: links inside a sentence (WCAG
          // 2.5.8 inline exception) and the visually hidden skip link.
          return (
            box.width > 0 &&
            box.height > 0 &&
            !el.closest('p') &&
            !el.classList.contains('sr-only') &&
            box.height < 48
          );
        })
        .map((el) => el.outerHTML.slice(0, 120)),
    );
    expect(small, path).toEqual([]);
  }
});

// One test per page: a failure names the page at once.
for (const path of [
  '/espace',
  '/espace/equipe',
  '/espace/journal',
  '/espace/parametres',
  '/espace/nouvelle-boutique',
  '/espace/produits',
  '/espace/produits/nouveau',
  '/espace/produits/categories',
  '/espace/produits/dddddddd-0000-4000-8000-000000000001',
  '/espace/vendre',
  '/espace/ventes',
  '/espace/clients',
  '/espace/clients/eeeeeeee-0000-4000-8000-000000000001',
  '/espace/factures',
  '/espace/factures/nouvelle',
  '/espace/statistiques',
  '/espace/tresorerie',
  '/espace/tresorerie/depenses',
  '/espace/comptabilite',
  '/espace/comptabilite?vue=etat',
  '/espace/abonnement',
]) {
  test(`${path} never overflows horizontally`, async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, 'awa', baseURL!);
    await page.goto(path);
    await expect(
      page.getByRole('main').getByRole('heading', { level: 1 }),
    ).toBeVisible();
    // clientWidth, not innerWidth: on mobile the layout viewport grows with
    // overflowing content, which would hide the problem.
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(0);
  });
}
