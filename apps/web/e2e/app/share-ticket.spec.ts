import { expect, test } from '@playwright/test';
import { resetBackend, signInAs } from '../support/session';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await resetBackend();
});
test.afterAll(async () => {
  await resetBackend();
});

interface Shared {
  name: string;
  type: string;
  head: string;
  size: number;
  title: string;
  activation: boolean | null;
}

/**
 * A phone hands the ticket to its share sheet (WhatsApp, SMS…). The sheet
 * itself is the phone's: here it is replaced by a stand-in that records
 * what it is given, as WhatsApp would receive it.
 */
test('on a phone, the ticket goes to the share sheet as a photo and a PDF', async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  await context.addInitScript(() => {
    const shared: unknown[] = [];
    Object.assign(window, { __shared: shared });
    navigator.canShare = (data) => Boolean(data?.files?.length);
    navigator.share = async (data) => {
      const file = data!.files![0]!;
      const bytes = new Uint8Array(await file.arrayBuffer());
      shared.push({
        name: file.name,
        type: file.type,
        size: file.size,
        title: data!.title,
        head: String.fromCharCode(...bytes.subarray(0, 8)),
        // Safari on iPhone needs the share to come with the touch.
        activation: navigator.userActivation?.isActive ?? null,
      });
    };
  });
  await signInAs(context, 'awa', baseURL!);
  await page.goto('/caisse');
  await page
    .getByRole('list', { name: 'Produits à vendre' })
    .getByRole('button', { name: /^Ajouter Eau/ })
    .click();
  if (isMobile) await page.getByRole('button', { name: /^Encaisser/ }).click();
  await page.getByRole('button', { name: /^Valider la vente/ }).click();
  const actions = page.getByRole('group', { name: 'Le ticket' });
  await actions.getByRole('button', { name: 'Envoyer en photo' }).click();
  await actions.getByRole('button', { name: 'Envoyer en PDF' }).click();

  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __shared: Shared[] }).__shared.length,
      ),
    )
    .toBe(2);
  const [photo, pdf] = await page.evaluate(
    () => (window as unknown as { __shared: Shared[] }).__shared,
  );
  expect(photo).toMatchObject({
    name: 'Ticket 000001 A-000001.png',
    type: 'image/png',
    title: 'Ticket 000001 A-000001',
    activation: true,
  });
  expect(photo!.head.slice(1, 4)).toBe('PNG');
  expect(pdf).toMatchObject({
    name: 'Ticket 000001 A-000001.pdf',
    type: 'application/pdf',
    activation: true,
  });
  expect(pdf!.head).toBe('%PDF-1.4');
  // Small enough for WhatsApp on a weak connection.
  expect(photo!.size).toBeLessThan(500_000);
  expect(pdf!.size).toBeLessThan(500_000);
  // No « saved on the device » message: the share sheet took the files.
  await expect(page.getByText(/enregistré sur l’appareil/)).toHaveCount(0);

  // The same from the sales history, with WhatsApp beside them.
  await page.goto('/espace/ventes');
  await page
    .getByRole('list', { name: 'Liste des ventes' })
    .getByRole('link')
    .first()
    .click();
  const later = page.getByRole('group', { name: 'Le ticket' });
  await later.getByRole('button', { name: 'Envoyer en photo' }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __shared: Shared[] }).__shared.length,
      ),
    )
    .toBe(1);
  await expect(
    later.getByRole('link', { name: 'Envoyer sur WhatsApp' }),
  ).toHaveAttribute('href', /^https:\/\/wa\.me\//);
});
