import { gzipSync } from 'node:zlib';
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
    const seen = await page.evaluate(() => {
      const entries = performance.getEntriesByType(
        'resource',
      ) as PerformanceResourceTiming[];
      const navigation = performance.getEntriesByType(
        'navigation',
      )[0] as PerformanceNavigationTiming;
      return {
        scripts: [
          ...new Set(
            entries
              .filter((e) => e.initiatorType === 'script')
              .map((e) => e.name),
          ),
        ],
        others:
          entries
            .filter((e) => e.initiatorType !== 'script')
            .reduce((sum, e) => sum + e.encodedBodySize, 0) +
          navigation.encodedBodySize,
      };
    });
    /*
     * Each script once, at its compressed size. Chromium reports a script
     * read again from its cache (preloaded, then executed) at its decoded
     * size: summing `encodedBodySize` counted 25 kB for a 9 kB file, at
     * random, and failed the budget on CI (2026-11-20). Gzip of the file
     * itself is what the network carries, the same on every run.
     */
    const sizes = await Promise.all(
      seen.scripts.map(async (url) => {
        const body = await (await page.request.get(url)).body();
        return { url, size: gzipSync(body).length };
      }),
    );
    const script = sizes.reduce((sum, s) => sum + s.size, 0);
    const total = script + seen.others;
    // The heaviest scripts, named in a failure: what to make lighter.
    const detail = `\n${sizes
      .sort((a, b) => b.size - a.size)
      .slice(0, 8)
      .map((s) => `${new URL(s.url).pathname} ${Math.round(s.size / 1024)} ko`)
      .join('\n')}`;
    expect(script, `JavaScript de ${path}${detail}`).toBeLessThanOrEqual(
      BUDGET.script,
    );
    expect(total, `Poids total de ${path}${detail}`).toBeLessThanOrEqual(
      BUDGET.total,
    );
  });
}
