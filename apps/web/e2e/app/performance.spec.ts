import { expect, test } from '@playwright/test';
import { signInAs } from '../support/session';

/**
 * Weight budget of a first visit (Phase 17), as sent over the network
 * (compressed). Measured on 2026-10-25: 186 to 251 KB of JavaScript and
 * about 90 KB of everything else per page; on a phone slowed four times on
 * « Fast 3G », the checkout is usable in about 4 s, then 1 s from cache.
 * The budget leaves room, and fails before a heavy library slips in.
 */
const BUDGET = { script: 300 * 1024, total: 450 * 1024 };

for (const path of [
  '/caisse',
  '/espace',
  '/espace/produits',
  '/espace/statistiques',
  '/espace/factures',
]) {
  test(`${path} stays within the weight budget of a first visit`, async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, 'awa', baseURL!);
    await page.goto(path, { waitUntil: 'networkidle' });
    const sent = await page.evaluate(() => {
      const entries = performance.getEntriesByType(
        'resource',
      ) as PerformanceResourceTiming[];
      const navigation = performance.getEntriesByType(
        'navigation',
      )[0] as PerformanceNavigationTiming;
      const script = entries
        .filter((e) => e.initiatorType === 'script')
        .reduce((sum, e) => sum + e.encodedBodySize, 0);
      const total =
        entries.reduce((sum, e) => sum + e.encodedBodySize, 0) +
        navigation.encodedBodySize;
      return { script, total };
    });
    expect(sent.script, `JavaScript de ${path}`).toBeLessThanOrEqual(
      BUDGET.script,
    );
    expect(sent.total, `Poids total de ${path}`).toBeLessThanOrEqual(
      BUDGET.total,
    );
  });
}
