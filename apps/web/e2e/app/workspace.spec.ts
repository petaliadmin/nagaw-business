import { expect, test, type Page } from '@playwright/test';
import { expectAccessible } from '../support/a11y';
import { resetBackend, signInAs } from '../support/session';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await resetBackend();
});

const IN_BOTTOM_BAR = ['Accueil', 'Ventes', 'Caisse', 'Stock', 'Argent'];
// Same entries in the sidebar, with their full label.
const SIDEBAR_LABEL: Record<string, string> = {
  Accueil: 'Tableau de bord',
  Stock: 'Produits et services',
  Argent: 'Trésorerie / Caisse',
};

/**
 * Desktop: the sidebar. Phones: the bottom bar, or the « Menu » sheet of
 * the top bar for the other pages (ADR-062). Only one « Navigation principale » is visible at a time.
 */
async function navigate(page: Page, isMobile: boolean, label: string) {
  if (isMobile && !IN_BOTTOM_BAR.includes(label)) {
    await page.getByRole('button', { name: 'Menu' }).click();
    await page
      .getByRole('dialog', { name: 'Menu' })
      .getByRole('navigation', { name: 'Autres pages' })
      .getByRole('link', { name: label })
      .click();
    return;
  }
  await page
    .getByRole('navigation', { name: 'Navigation principale' })
    .getByRole('link', {
      name: isMobile ? label : (SIDEBAR_LABEL[label] ?? label),
    })
    .click();
}

/** The shop is changed in Paramètres, not in the menu (2026-10-26). */
async function shopSwitcher(page: Page) {
  await page.goto('/espace/parametres?partie=boutiques');
  return page.getByRole('region', { name: 'Mes boutiques' });
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
  // The team lives in « Équipe », not on the dashboard (2026-10-25).
  await expect(
    main.getByRole('region', { name: 'Votre boutique' }),
  ).toHaveCount(0);
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

  // Team and history are rows of the « Paramètres » menu (ADR-063).
  await navigate(page, isMobile, 'Paramètres');
  await expect(page).toHaveURL(/\/espace\/parametres$/);
  const settings = page.getByRole('main');
  await settings.getByRole('link', { name: 'Équipe' }).click();
  await expect(page).toHaveURL(/\/espace\/equipe$/);
  const members = page.getByRole('list', { name: 'Équipe de Acme Dakar' });
  await expect(members.getByRole('listitem')).toHaveCount(2);
  await expect(members).toContainText('moussa@acme.test');
  await expect(members).toContainText('Vendeur');

  await page.goto('/espace/parametres');
  await settings.getByRole('link', { name: 'Historique' }).click();
  await expect(page).toHaveURL(/\/espace\/journal$/);
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(26); // header + 25
  await page.getByRole('link', { name: 'Entrées plus anciennes' }).click();
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(3); // header + 2
  await expect(page.getByRole('table')).toContainText('Boutique créée');
  // The menu entry of its section is marked.
  if (isMobile) {
    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(
      page
        .getByRole('dialog', { name: 'Menu' })
        .getByRole('link', { name: 'Historique' }),
    ).toHaveAttribute('aria-current', 'page');
    await page.keyboard.press('Escape');
  } else {
    await expect(
      page
        .getByRole('navigation', { name: 'Navigation principale' })
        .getByRole('link', { name: 'Paramètres' }),
    ).toHaveAttribute('aria-current', 'page');
  }

  // « Fournisseurs » is marked on its own page, not « Produits et services ».
  await navigate(page, isMobile, 'Fournisseurs');
  await expect(page).toHaveURL(/\/espace\/produits\/fournisseurs$/);

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
  await page.goto('/espace/parametres?partie=boutique');
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
  await page.goto('/espace/parametres?partie=boutique');
  await page.getByLabel('Nom de la boutique').fill('A');
  await page
    .getByRole('region', { name: 'Boutique' })
    .getByRole('button', { name: 'Enregistrer' })
    .click();
  await expect(
    page.getByText('Le nom doit contenir au moins 2 caractères'),
  ).toBeVisible();
});

test('the name of the shop changes shop, in one touch', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /changer de boutique$/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Changer de boutique' });
  await expectAccessible(page, 'changer de boutique');
  await expect(sheet.getByText('Boutique ouverte')).toBeAttached();
  await expect(
    sheet.getByRole('link', { name: 'Créer une boutique' }),
  ).toBeVisible();
  await sheet.getByRole('button', { name: /Globex Sénégal/ }).click();

  await expect(
    page
      .getByRole('main')
      .getByRole('heading', { level: 1, name: 'Globex Sénégal' }),
  ).toBeVisible();
  await expect(sheet).toBeHidden();
});

test('switching shop changes data and permissions', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  // Paramètres keeps its list; the sidebar has the name of the shop (ADR-051).
  await expect(
    page
      .getByRole('complementary', { name: 'Barre latérale' })
      .getByLabel('Boutique'),
  ).toHaveCount(0);
  const scope = await shopSwitcher(page);
  // Choosing the shop opens it at once; the list says so (WCAG 3.2.2).
  await expect(scope.getByLabel('Boutique')).toHaveAccessibleDescription(
    'La boutique choisie s’ouvre aussitôt.',
  );
  await scope.getByLabel('Boutique').selectOption({ label: 'Globex Sénégal' });

  const main = page.getByRole('main');
  await expect(
    main.getByRole('heading', { level: 1, name: 'Globex Sénégal' }),
  ).toBeVisible();
  // Awa is a plain member of Globex: no audit access, read-only settings.
  await expect(
    main.getByRole('region', { name: 'Activité récente' }),
  ).toHaveCount(0);
  await page.goto('/espace/parametres?partie=boutique');
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
    page.getByRole('heading', { level: 1, name: 'Votre boutique' }),
  ).toBeVisible();
  await page.getByLabel('Nom de la boutique').fill('Binta Conseil');
  await page.getByLabel('Votre nom complet').fill('Binta Sow');
  // Her number is known from sign-up: it is not asked again.
  await expect(page.getByLabel('Votre téléphone')).toHaveCount(0);
  // Three steps, then the application they give (maquette « Profils »).
  await expect(page.getByText('Étape 1 sur 3')).toBeVisible();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page.getByText('Étape 2 sur 3')).toBeVisible();
  await page.locator('label', { hasText: 'Des services' }).click();
  await expect(page.getByRole('status')).toContainText('« Services »');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page.getByText('Étape 3 sur 3')).toBeVisible();
  // A shop of services is not asked about stock.
  await expect(
    page.getByRole('group', { name: 'Comptez-vous ce qu’il vous reste ?' }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Voir mon application' }).click();
  await expect(
    page.getByRole('heading', { name: 'Voici votre application' }),
  ).toBeVisible();
  // A workshop that invoices: « Factures » and « Services » in its bar.
  await expect(
    page
      .getByRole('region', { name: 'En bas de l’écran' })
      .getByRole('listitem'),
  ).toHaveText(['Accueil', 'Factures', 'Caisse', 'Services', 'Argent']);
  await page.getByRole('button', { name: 'C’est parti' }).click();
  await expect(
    page
      .getByRole('main')
      .getByRole('heading', { level: 1, name: 'Binta Conseil' }),
  ).toBeVisible();
  await resetBackend();
});

test('a simple shop sees only what it uses, and can show everything again (ADR-067)', async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  await signInAs(context, 'binta', baseURL!);
  await page.goto('/espace');
  // The name is asked first: no going on without it.
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: 'Donnez le nom de votre boutique.' }),
  ).toBeVisible();
  await page.getByLabel('Nom de la boutique').fill('Fatou légumes');
  await page.getByLabel('Votre nom complet').fill('Fatou Diop');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page.getByText('Étape 2 sur 3')).toBeVisible();
  await page.getByRole('button', { name: 'Continuer' }).click();
  const answer = (question: string, value: 'Oui' | 'Non') =>
    page
      .getByRole('group', { name: question })
      .locator('label', { hasText: value })
      .click();
  await answer('Comptez-vous ce qu’il vous reste ?', 'Non');
  await answer('Faites-vous des factures ou des devis ?', 'Non');
  await answer('Quelqu’un vend avec vous ?', 'Non');
  await expectAccessible(page, 'création, comment travaillez-vous');
  await page.getByRole('button', { name: 'Voir mon application' }).click();
  const hidden = page.getByRole('region', { name: 'Caché pour l’instant' });
  for (const part of [
    'Clients',
    'Factures et devis',
    'Fournisseurs',
    'Rapports',
    'Équipe',
  ])
    await expect(hidden).toContainText(part);
  await expect(
    page
      .getByRole('region', { name: 'En bas de l’écran' })
      .getByRole('listitem'),
  ).toHaveText(['Accueil', 'Ventes', 'Caisse', 'Crédit', 'Argent']);
  await expectAccessible(page, 'création, voici votre application');
  // « Changer mes réponses » goes back, the answers kept.
  await page.getByRole('button', { name: 'Changer mes réponses' }).click();
  await expect(page.getByText('Étape 3 sur 3')).toBeVisible();
  // « Revenir », beside the title, goes back one step.
  await page.getByRole('button', { name: 'Revenir' }).click();
  await expect(page.getByText('Étape 2 sur 3')).toBeVisible();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: 'Voir mon application' }).click();
  await page.getByRole('button', { name: 'C’est parti' }).click();
  await expect(
    page
      .getByRole('main')
      .getByRole('heading', { level: 1, name: 'Fatou légumes' }),
  ).toBeVisible();

  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  if (isMobile) {
    // Nothing counted, sold on credit: « Crédit » in the bar (ADR-067).
    await expect(nav.getByRole('link')).toHaveText([
      'Accueil',
      'Ventes',
      'Caisse',
      'Crédit',
      'Argent',
    ]);
    await page.getByRole('button', { name: 'Menu' }).click();
    const menu = page.getByRole('dialog', { name: 'Menu' });
    // The catalogue left the bar: it is in the Menu, credit is not twice.
    await expect(menu.getByRole('link', { name: 'Produits' })).toBeVisible();
    await expect(
      menu.getByRole('link', { name: 'Ils vous doivent' }),
    ).toHaveCount(0);
    for (const hidden of [
      'Clients',
      'Factures / Devis',
      'Fournisseurs',
      'Équipe',
    ])
      await expect(menu.getByRole('link', { name: hidden })).toHaveCount(0);
    await page.keyboard.press('Escape');
  } else {
    for (const hidden of [
      'Clients',
      'Factures / Devis',
      'Fournisseurs',
      'Rapports / Statistiques',
    ])
      await expect(nav.getByRole('link', { name: hidden })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Dépenses' })).toBeVisible();
  }
  // No shortcut to a hidden part on the home page.
  await expect(page.getByRole('link', { name: 'Facture / devis' })).toHaveCount(
    0,
  );

  // A new product does not count its stock unless asked.
  await page.goto('/espace/produits/nouveau');
  await expect(
    page.getByLabel('Suivre le stock de ce produit', { exact: true }),
  ).not.toBeChecked();

  // Paramètres › Mon application: the hidden parts, then everything again.
  await page.goto('/espace/parametres?partie=application');
  await page.waitForLoadState('networkidle');
  await expect(page.getByLabel('Afficher Clients')).not.toBeChecked();
  await expect(page.getByLabel('Afficher Ils vous doivent')).toBeChecked();
  await expectAccessible(page, 'Mon application');
  await page.getByRole('button', { name: 'Tout afficher' }).click();
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'Toute l’application est affichée.' }),
  ).toBeVisible();
  await page.goto('/espace');
  if (isMobile) {
    await expect(nav.getByRole('link', { name: 'Stock' })).toBeVisible();
  } else {
    await expect(nav.getByRole('link', { name: 'Clients' })).toBeVisible();
  }
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

test('phone navigation: bottom bar and a keyboard-friendly « Menu » sheet', async ({
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

  const button = page.getByRole('button', { name: 'Menu' });
  await expect(button).toHaveAttribute('aria-expanded', 'false');
  await button.click();
  const dialog = page.getByRole('dialog', { name: 'Menu' });
  await expect(dialog).toBeVisible();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  await expect(dialog).toContainText('awa@acme.test');
  await expect(
    dialog.getByRole('button', { name: 'Se déconnecter' }),
  ).toBeVisible();
  // A modal: Tab never leaves the sheet for the page behind (WCAG 2.4.3).
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab');
    expect(
      // Between the last and the first control, the browser's own bar.
      await page.evaluate(() => {
        const active = document.activeElement;
        return (
          !active || active === document.body || !!active.closest('dialog')
        );
      }),
    ).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(button).toBeFocused();
});

test('touch targets are at least 44 px high', async ({
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
            box.height < 44
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
  '/espace/parametres?partie=application',
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
