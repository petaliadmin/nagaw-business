import { expect, test, type Page } from '@playwright/test';
import {
  addLargeSale,
  resetBackend,
  signInAs,
  useLongNames,
} from '../support/session';

test.beforeAll(async () => {
  await resetBackend();
  await addLargeSale();
  await useLongNames();
});

test.afterAll(async () => {
  await resetBackend();
});

const PAGES = [
  '/espace',
  '/espace/ventes',
  '/espace/ventes?vue=toutes',
  '/espace/produits',
  '/espace/produits/dddddddd-0000-4000-8000-000000000001',
  '/espace/clients',
  '/espace/clients/eeeeeeee-0000-4000-8000-000000000001',
  '/espace/factures',
  '/espace/factures?type=devis',
  '/espace/statistiques',
  '/espace/tresorerie',
  '/espace/tresorerie/depenses',
  '/espace/tresorerie/cloture',
  '/espace/comptabilite',
  '/espace/parametres',
  '/espace/equipe',
  '/espace/abonnement',
  '/caisse',
];

/** Text that leaves the box around it, outside the regions that scroll. */
function overflowing(page: Page) {
  return page.evaluate(() => {
    const scrolls = (el: Element | null) => {
      for (let at = el; at; at = at.parentElement) {
        const { overflowX } = getComputedStyle(at);
        // Scrolls, or cut on purpose with « … » (top bar).
        if (overflowX !== 'visible') return true;
      }
      return false;
    };
    const found: string[] = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const parent = node.parentElement;
      if (!node.textContent?.trim() || !parent || scrolls(parent)) continue;
      if (parent.closest('.sr-only, script, style, dialog:not([open])'))
        continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const text = range.getBoundingClientRect();
      if (text.width === 0) continue;
      // The nearest box with a look of its own: a tile, a card, a button.
      let box: Element = parent;
      while (box.parentElement) {
        const style = getComputedStyle(box);
        if (
          style.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
          style.borderLeftWidth !== '0px'
        )
          break;
        box = box.parentElement;
      }
      const { left, right } = box.getBoundingClientRect();
      if (text.right > right + 1 || text.left < left - 1)
        found.push(node.textContent.trim().slice(0, 60));
    }
    return found;
  });
}

for (const path of PAGES) {
  test(`${path}: nothing leaves its frame at 360 px`, async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, 'awa', baseURL!);
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    expect(await overflowing(page)).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}
