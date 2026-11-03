import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { resetBackend, signInAs } from '../support/session';

const FATOU = '/espace/clients/eeeeeeee-0000-4000-8000-000000000001';

test.beforeAll(async () => {
  await resetBackend();
});

test('a customer is saved in the phone contacts', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto(FATOU);
  const download = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Enregistrer dans mon téléphone' })
    .click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('Fatou Ndiaye.vcf');
  const card = await readFile(await file.path(), 'utf8');
  expect(card).toContain('FN:Fatou Ndiaye\r\n');
  expect(card).toContain('TEL;TYPE=CELL:+221771112233\r\n');
  await expect(page.getByRole('status')).toContainText(
    'Ouvrez le fichier téléchargé',
  );
});

test('the « ⋮ » of a customer saves it in the phone contacts', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/clients');
  await page
    .getByRole('button', { name: 'Plus d’actions pour Fatou Ndiaye' })
    .click();
  const sheet = page.getByRole('dialog', { name: 'Fatou Ndiaye' });
  await expect(
    sheet.getByRole('link', { name: 'Appeler le 77 111 22 33' }),
  ).toBeVisible();
  const download = page.waitForEvent('download');
  await sheet.getByRole('button', { name: 'Ajouter à mes contacts' }).click();
  expect((await download).suggestedFilename()).toBe('Fatou Ndiaye.vcf');
});

test('the « ⋮ » of a customer removes it, after asking', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/clients');
  await page.getByRole('button', { name: 'Ajouter un client' }).click();
  await page.getByRole('button', { name: 'Créer' }).click();
  await page
    .getByRole('dialog', { name: 'Nouveau client' })
    .getByLabel('Nom')
    .fill('Ousmane Diallo');
  await page.getByRole('button', { name: 'Ajouter le client' }).click();
  await expect(page).toHaveURL(/\/espace\/clients\/[^/?]+$/);

  await page.goto('/espace/clients');
  const list = page.getByRole('list', { name: 'Liste des clients' });
  await page
    .getByRole('button', { name: 'Plus d’actions pour Ousmane Diallo' })
    .click();
  const sheet = page.getByRole('dialog', { name: 'Ousmane Diallo' });
  await sheet.getByRole('button', { name: 'Supprimer le client' }).click();
  await sheet.getByRole('button', { name: 'Non, garder' }).click();
  await sheet.getByRole('button', { name: 'Supprimer le client' }).click();
  await sheet.getByRole('button', { name: 'Oui, supprimer' }).click();
  await expect(list).not.toContainText('Ousmane Diallo');
  await expect(list).toContainText('Fatou Ndiaye');
});

test('a customer is created from the « + » button', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/clients');
  await page.getByRole('button', { name: 'Ajouter un client' }).click();
  await page
    .getByRole('list', { name: 'Nouveau client' })
    .getByRole('button', { name: 'Créer' })
    .click();
  const sheet = page.getByRole('dialog', { name: 'Nouveau client' });
  await sheet.getByLabel('Nom').fill('Aminata Ba');
  await sheet.getByRole('button', { name: 'Ajouter le client' }).click();
  await expect(page).toHaveURL(/\/espace\/clients\/[^/?]+$/);
  await expect(
    page.getByRole('heading', { name: 'Aminata Ba', level: 1 }),
  ).toBeVisible();
});

test('a customer is imported from the phone contacts', async ({
  page,
  context,
  baseURL,
}) => {
  // Contact Picker API of Chrome on Android, with one contact chosen.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'contacts', {
      value: {
        getProperties: async () => ['name', 'tel', 'email'],
        select: async () => [
          {
            name: ['Moussa Fall'],
            tel: ['+221 76 000 11 22'],
            email: [],
          },
        ],
      },
    });
  });
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/clients');
  await page.getByRole('button', { name: 'Ajouter un client' }).click();
  await page.getByRole('button', { name: 'Importer de mes contacts' }).click();
  const sheet = page.getByRole('dialog', { name: 'Nouveau client' });
  await expect(sheet.getByLabel('Nom')).toHaveValue('Moussa Fall');
  await expect(sheet.getByLabel('Téléphone (facultatif)')).toHaveValue(
    '+221 76 000 11 22',
  );
  await expect(sheet.getByLabel('E-mail (facultatif)')).toHaveValue('');
  await expect(sheet.getByRole('status')).toContainText('Vérifiez');
});

test('without access to the contacts, a contact file is imported', async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/espace/clients');
  await page.getByRole('button', { name: 'Ajouter un client' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importer une fiche .vcf' }).click();
  await (
    await chooser
  ).setFiles({
    name: 'Binta.vcf',
    mimeType: 'text/vcard',
    buffer: Buffer.from(
      'BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Binta Sarr\r\nTEL;TYPE=CELL:77 222 33 44\r\nEND:VCARD\r\n',
    ),
  });
  const sheet = page.getByRole('dialog', { name: 'Nouveau client' });
  await expect(sheet.getByLabel('Nom')).toHaveValue('Binta Sarr');
  await expect(sheet.getByLabel('Téléphone (facultatif)')).toHaveValue(
    '77 222 33 44',
  );
});
