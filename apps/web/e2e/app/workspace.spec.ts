import { expect, test, type Page } from '@playwright/test';
import { resetBackend, signInAs } from '../support/session';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await resetBackend();
});

/** Navigation lives in the sidebar (desktop) or behind the menu (mobile). */
async function navigate(page: Page, isMobile: boolean, label: string) {
  if (isMobile) await page.getByRole('button', { name: 'Menu' }).click();
  const scope = isMobile
    ? page.getByRole('dialog', { name: 'Menu principal' })
    : page.getByRole('complementary', { name: 'Barre latérale' });
  await scope
    .getByRole('navigation', { name: 'Navigation principale' })
    .getByRole('link', { name: label })
    .click();
}

test('redirects to sign-in without a session', async ({ page }) => {
  await page.goto('/espace');
  await expect(page).toHaveURL(/\/connexion$/);
});

test('overview shows only real data for the active organization', async ({
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
  await expect(main.getByText('Membres actifs')).toBeVisible();
  await expect(main.locator('dd').first()).toHaveText('2');
  await expect(main.getByText('Propriétaire')).toBeVisible();
  // Latest of the 27 audit entries comes first, with the author's e-mail.
  const activity = main.getByRole('region', { name: 'Activité récente' });
  await expect(activity.getByRole('listitem')).toHaveCount(5);
  await expect(activity.getByRole('listitem').first()).toContainText(
    'Paramètres de l’organisation modifiés — awa@acme.test',
  );
  // Upcoming modules are announced without links.
  const upcoming = main.getByRole('region', { name: 'Prochainement' });
  await expect(upcoming.getByText('Responsabilités déléguées')).toBeVisible();
  await expect(upcoming.getByRole('link')).toHaveCount(0);
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
  const members = page.getByRole('table', { name: 'Membres de Acme Dakar' });
  await expect(members.getByRole('row')).toHaveCount(3);
  await expect(members).toContainText('moussa@acme.test');
  await expect(members).toContainText('Membre');

  await navigate(page, isMobile, 'Journal d’audit');
  await expect(page).toHaveURL(/\/espace\/journal$/);
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(26); // header + 25
  await page.getByRole('link', { name: 'Entrées plus anciennes' }).click();
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(3); // header + 2
  await expect(page.getByRole('table')).toContainText('Organisation créée');

  await navigate(page, isMobile, 'Paramètres');
  await expect(page).toHaveURL(/\/espace\/parametres$/);

  if (!isMobile) {
    const current = page
      .getByRole('navigation', { name: 'Navigation principale' })
      .getByRole('link', { name: 'Paramètres' });
    await expect(current).toHaveAttribute('aria-current', 'page');
  }
});

test('owner updates the organization settings', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/parametres');
  await page.getByLabel('Nom de l’organisation').fill('Acme Dakar SA');
  await page.getByLabel('Fuseau horaire').selectOption('Africa/Abidjan');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(
    page
      .getByRole('main')
      .getByRole('status')
      .filter({ hasText: 'Paramètres enregistrés.' }),
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
  await page.getByLabel('Nom de l’organisation').fill('A');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(
    page.getByText('Le nom doit contenir au moins 2 caractères'),
  ).toBeVisible();
});

test('switching organization changes data and permissions', async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace');
  if (isMobile) await page.getByRole('button', { name: 'Menu' }).click();
  const scope = isMobile
    ? page.getByRole('dialog', { name: 'Menu principal' })
    : page.getByRole('complementary', { name: 'Barre latérale' });
  await scope
    .getByLabel('Organisation')
    .selectOption({ label: 'Globex Sénégal' });

  const main = page.getByRole('main');
  await expect(
    main.getByRole('heading', { level: 1, name: 'Globex Sénégal' }),
  ).toBeVisible();
  // Awa is a plain member of Globex: no audit access, read-only settings.
  await expect(
    main.getByText('Votre rôle ne donne pas accès au journal d’audit.'),
  ).toBeVisible();
  await page.goto('/espace/parametres');
  await expect(page.getByRole('button', { name: 'Enregistrer' })).toHaveCount(
    0,
  );
  await expect(
    page.getByText(
      'Seuls les propriétaires et administrateurs peuvent modifier ces paramètres.',
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

test('a user without organization is guided to create one', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'binta', baseURL!);
  await page.goto('/espace/equipe');
  await expect(
    page.getByRole('heading', { name: 'Créez votre organisation' }),
  ).toBeVisible();
  await page.getByLabel('Nom de l’entreprise').fill('Binta Conseil');
  await page.getByRole('button', { name: 'Créer l’organisation' }).click();
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

test('mobile menu is keyboard friendly', async ({
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
  const button = page.getByRole('button', { name: 'Menu' });
  await expect(button).toHaveAttribute('aria-expanded', 'false');
  await button.click();
  const dialog = page.getByRole('dialog', { name: 'Menu principal' });
  await expect(dialog).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Fermer le menu' }).first(),
  ).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(button).toBeFocused();
});

test('pages never overflow horizontally', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  for (const path of [
    '/espace',
    '/espace/equipe',
    '/espace/journal',
    '/espace/parametres',
    '/espace/agents',
  ]) {
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
  }
});
