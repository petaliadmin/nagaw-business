import { expect, test } from '@playwright/test';
import { resetBackend, signInAs } from '../support/session';

test.describe.configure({ mode: 'serial' });

let invitationPath: string;

test.beforeAll(async () => {
  await resetBackend();
});

test('owner invites a collaborator and gets a one-time link', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/equipe');
  const invite = page.getByRole('region', { name: 'Inviter un collaborateur' });
  await invite.getByLabel('Adresse e-mail').fill('Binta@New.test');
  await invite.getByLabel('Rôle').selectOption({ label: 'Gérant' });
  await invite.getByRole('button', { name: 'Inviter' }).click();

  const link = invite.getByLabel('Lien d’invitation');
  await expect(link).toHaveValue(/\/invitation\?jeton=[A-Za-z0-9_-]{43}$/);
  await expect(invite).toContainText(
    'L’envoi automatique par e-mail n’est pas encore configuré',
  );
  const url = new URL(await link.inputValue());
  invitationPath = `${url.pathname}${url.search}`;

  const pending = page.getByRole('list', { name: 'Invitations en attente' });
  await expect(pending).toContainText('binta@new.test');
  await expect(pending).toContainText('Gérant');
  await expect(pending).toContainText('awa@acme.test');
});

test('a signed-out visitor is asked to sign in, then brought back', async ({
  page,
}) => {
  await page.goto(invitationPath);
  const signIn = page.getByRole('link', { name: 'Se connecter pour accepter' });
  await expect(signIn).toHaveAttribute(
    'href',
    `/connexion?next=${encodeURIComponent(invitationPath)}`,
  );
  await signIn.click();
  await expect(page.locator('input[name="next"]')).toHaveValue(invitationPath);
});

test('another account cannot use the invitation', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'moussa', baseURL!);
  await page.goto(invitationPath);
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Cette invitation est destinée à binta@new.test, mais vous êtes connecté avec moussa@acme.test.',
  );
  await expect(
    page.getByRole('button', { name: 'Accepter l’invitation' }),
  ).toHaveCount(0);
});

test('the invitee accepts and lands in the organization', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'binta', baseURL!);
  await page.goto(invitationPath);
  await expect(page.getByRole('main')).toContainText(
    'Vous êtes invité à rejoindre Acme Dakar en tant que gérant.',
  );
  await page.getByRole('button', { name: 'Accepter l’invitation' }).click();
  await expect(
    page
      .getByRole('main')
      .getByRole('heading', { level: 1, name: 'Acme Dakar' }),
  ).toBeVisible();

  // Single use.
  await page.goto(invitationPath);
  await expect(page.getByRole('main').getByRole('alert')).toHaveText(
    'Cette invitation a déjà été acceptée.',
  );
});

test('members see the team without management controls', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'moussa', baseURL!);
  await page.goto('/espace/equipe');
  // Moussa's active organization is Acme (alphabetical first).
  await expect(
    page.getByRole('table', { name: 'Équipe de Acme Dakar' }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Inviter un collaborateur' }),
  ).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: 'Actions' })).toHaveCount(
    0,
  );
});

test('owner changes a role and disables then reactivates a member', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/equipe');
  const members = page.getByRole('table', { name: 'Équipe de Acme Dakar' });
  const moussa = members.getByRole('row', { name: /moussa@acme\.test/ });

  await moussa
    .getByLabel('Rôle de moussa@acme.test', { exact: true })
    .selectOption({ label: 'Lecteur' });
  await moussa
    .getByRole('button', { name: 'Changer le rôle de moussa@acme.test' })
    .click();
  await expect(moussa.getByText('Modification enregistrée.')).toBeVisible();
  await expect(moussa).toContainText('Lecteur');

  await moussa
    .getByRole('button', { name: 'Désactiver moussa@acme.test' })
    .click();
  await expect(moussa).toContainText('Désactivé');
  await moussa
    .getByRole('button', { name: 'Réactiver moussa@acme.test' })
    .click();
  await expect(moussa).toContainText('Actif');

  // No controls on one's own row.
  const self = members.getByRole('row', { name: /awa@acme\.test/ });
  await expect(self.getByRole('button')).toHaveCount(0);

  await page.goto('/espace/journal');
  await expect(page.getByRole('table')).toContainText(
    'Accès d’une personne désactivé',
  );
  await expect(page.getByRole('table')).toContainText(
    'Rôle d’une personne modifié',
  );
});

test('owner revokes a pending invitation', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/equipe');
  const invite = page.getByRole('region', { name: 'Inviter un collaborateur' });
  await invite.getByLabel('Adresse e-mail').fill('fatou@new.test');
  await invite.getByRole('button', { name: 'Inviter' }).click();
  await expect(invite.getByLabel('Lien d’invitation')).toBeVisible();
  // clientWidth, not innerWidth: on mobile the layout viewport grows with
  // overflowing content, which would hide the problem.
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  await page
    .getByRole('button', { name: 'Annuler l’invitation de fatou@new.test' })
    .click();
  await expect(page.getByText('Aucune invitation en attente')).toBeVisible();
});

test('invalid input is rejected before reaching the API', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/equipe');
  const invite = page.getByRole('region', { name: 'Inviter un collaborateur' });
  await invite.getByLabel('Adresse e-mail').fill('pas-une-adresse');
  await invite.getByRole('button', { name: 'Inviter' }).click();
  await expect(invite.getByText('Adresse e-mail invalide')).toBeVisible();

  await page.goto('/invitation?jeton=trop-court');
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Ce lien d’invitation est incomplet ou invalide.',
  );
});
