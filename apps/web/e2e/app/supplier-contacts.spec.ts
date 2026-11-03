import { expect, test } from '@playwright/test';
import { resetBackend, signInAs } from '../support/session';

const SUPPLIERS = '/espace/produits/fournisseurs';

test.beforeAll(async () => {
  await resetBackend();
});

test('a supplier is created, changed, removed and put back', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto(SUPPLIERS);
  await page.getByRole('button', { name: 'Ajouter un fournisseur' }).click();
  await page.getByRole('button', { name: 'Créer' }).click();
  const sheet = page.getByRole('dialog', { name: 'Nouveau fournisseur' });
  await sheet.getByLabel('Nom').fill('Dépôt Thiaroye');
  await sheet.getByLabel('Téléphone (facultatif)').fill('76 555 44 33');
  await sheet.getByRole('button', { name: 'Ajouter le fournisseur' }).click();
  await expect(sheet).toBeHidden();
  const list = page.getByRole('list', { name: 'Fournisseurs' });
  await expect(list).toContainText('Dépôt Thiaroye');

  const more = () =>
    page
      .getByRole('button', { name: 'Plus d’actions pour Dépôt Thiaroye' })
      .click();
  const actions = page.getByRole('dialog', { name: 'Dépôt Thiaroye' });
  await more();
  const download = page.waitForEvent('download');
  await actions.getByRole('button', { name: 'Ajouter à mes contacts' }).click();
  expect((await download).suggestedFilename()).toBe('Dépôt Thiaroye.vcf');
  await actions.getByRole('button', { name: 'Modifier' }).click();
  await actions.getByLabel('Téléphone (facultatif)').fill('76 555 44 34');
  await actions.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(actions).toBeHidden();
  await expect(list).toContainText('76 555 44 34');

  await more();
  await actions
    .getByRole('button', { name: 'Supprimer le fournisseur' })
    .click();
  await actions.getByRole('button', { name: 'Oui, supprimer' }).click();
  await expect(actions).toBeHidden();
  await expect(
    list.getByRole('listitem').filter({ hasText: 'Dépôt Thiaroye' }),
  ).toContainText('Supprimé');

  await more();
  await actions.getByRole('button', { name: 'Remettre dans la liste' }).click();
  await actions.getByRole('button', { name: 'Oui, remettre' }).click();
  await expect(
    list.getByRole('listitem').filter({ hasText: 'Dépôt Thiaroye' }),
  ).not.toContainText('Supprimé');
});

test('a supplier is imported from a contact file', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto(SUPPLIERS);
  await page.getByRole('button', { name: 'Ajouter un fournisseur' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importer une fiche .vcf' }).click();
  await (
    await chooser
  ).setFiles({
    name: 'Ibrahima.vcf',
    mimeType: 'text/vcard',
    buffer: Buffer.from(
      'BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Ibrahima Gaye\r\nTEL:77 999 88 77\r\nEND:VCARD\r\n',
    ),
  });
  const sheet = page.getByRole('dialog', { name: 'Nouveau fournisseur' });
  await expect(sheet.getByLabel('Nom')).toHaveValue('Ibrahima Gaye');
  await expect(sheet.getByLabel('Téléphone (facultatif)')).toHaveValue(
    '77 999 88 77',
  );
  await expect(sheet.getByRole('status')).toContainText(
    '« Ajouter le fournisseur »',
  );
});

test('a seller sees the suppliers but cannot change them', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'moussa', baseURL!);
  await page.goto(SUPPLIERS);
  await expect(
    page.getByRole('button', { name: 'Ajouter un fournisseur' }),
  ).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Plus d’actions pour Grossiste Sandaga' })
    .click();
  const actions = page.getByRole('dialog', { name: 'Grossiste Sandaga' });
  await expect(actions.getByRole('link', { name: /^Appeler/ })).toBeVisible();
  await expect(actions.getByRole('button', { name: 'Modifier' })).toHaveCount(
    0,
  );
});
