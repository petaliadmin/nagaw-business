import { expect, test } from '@playwright/test';
import { addLargeSale, resetBackend, signInAs } from '../support/session';

test.beforeAll(async () => {
  await resetBackend();
  await addLargeSale();
});

test.afterAll(async () => {
  await resetBackend();
});

for (const path of ['/espace/ventes', '/espace']) {
  test(`${path}: the largest amounts stay inside their tiles at 360 px`, async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, 'awa', baseURL!);
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(path);
    await expect(
      page
        .locator('main dd')
        .getByText(/9\D987\D654\D321/)
        .first(),
    ).toBeVisible();

    const outside = await page.locator('main dd').evaluateAll((figures) =>
      figures
        .filter((figure) => {
          const tile = figure.closest('div')!.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(figure);
          return range.getBoundingClientRect().right > tile.right;
        })
        .map((figure) => figure.textContent),
    );
    expect(outside).toEqual([]);

    // Digits stay together: a line break is only allowed before the currency.
    const lines = await page
      .locator('main dd .figure')
      .getByText(/9\D987\D654\D321/)
      .first()
      .evaluate((figure) => {
        const text = figure.firstChild!;
        const range = document.createRange();
        range.setStart(text, 0);
        range.setEnd(text, text.textContent!.indexOf(' '));
        return range.getClientRects().length;
      });
    expect(lines).toBe(1);

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}
