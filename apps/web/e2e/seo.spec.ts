import { expect, test, type Page } from '@playwright/test';

/** Every JSON-LD node of the page, `@graph` documents flattened. */
async function structuredData(page: Page) {
  const scripts = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  return scripts.flatMap((text) => {
    const data = JSON.parse(text);
    return (data['@graph'] ?? [data]) as Record<string, unknown>[];
  });
}

test('the home page links to the guides and describes the product', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    /^https?:\/\/[^/]+\/?$/,
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    /opengraph-image/,
  );
  const types = (await structuredData(page)).map((node) => node['@type']);
  expect(types).toEqual(
    expect.arrayContaining([
      'Organization',
      'WebSite',
      'SoftwareApplication',
      'FAQPage',
    ]),
  );
  await page.getByRole('link', { name: 'Voir tous les guides' }).click();
  await expect(page).toHaveURL(/\/blog$/);
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Guides pour gérer sa boutique',
    }),
  ).toBeVisible();
});

test('the guides list every article, grouped by theme', async ({ page }) => {
  await page.goto('/blog');
  // One featured guide and nineteen cards.
  await expect(page.locator('main article')).toHaveCount(20);
  await expect(
    page.getByRole('heading', { level: 2, name: 'Stock' }),
  ).toBeVisible();
  await page
    .getByRole('link', {
      name: 'Clôture de caisse : compter son argent le soir et trouver les écarts',
    })
    .click();
  await expect(page).toHaveURL(/\/blog\/cloture-de-caisse$/);
});

test('an article answers first, then details, with structured data', async ({
  page,
}) => {
  await page.goto('/blog/cloture-de-caisse');
  await expect(page).toHaveTitle(
    'Clôture de caisse : méthode et écart de caisse expliqué | Nagaw Business',
  );
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Clôture de caisse : compter son argent le soir et trouver les écarts',
  );
  await expect(
    page.getByRole('heading', { level: 2, name: 'En bref' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Questions fréquentes' }),
  ).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    /\/blog\/cloture-de-caisse$/,
  );
  const nodes = await structuredData(page);
  const article = nodes.find((node) => node['@type'] === 'BlogPosting');
  expect(article).toMatchObject({
    datePublished: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    inLanguage: 'fr',
  });
  expect(nodes.map((node) => node['@type'])).toEqual(
    expect.arrayContaining(['BreadcrumbList', 'FAQPage']),
  );
  // Table of contents leads to the section.
  await page
    .getByRole('navigation', { name: 'Dans cet article' })
    .getByRole('link', { name: 'D’où vient un écart de caisse ?' })
    .click();
  await expect(page).toHaveURL(/#d-ou-vient-un-ecart-de-caisse$/);
});

test('an unknown article is a 404 page', async ({ page }) => {
  await page.goto('/blog/article-qui-n-existe-pas');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Page introuvable' }),
  ).toBeVisible();
});

test('robots.txt opens the public pages and closes the app', async ({
  request,
}) => {
  const text = await (await request.get('/robots.txt')).text();
  expect(text).toContain('Disallow: /espace');
  expect(text).toContain('Disallow: /caisse');
  expect(text).toContain('User-Agent: GPTBot');
  expect(text).toMatch(/Sitemap: .*\/sitemap\.xml/);
});

test('the sitemap lists the home page and every guide', async ({ request }) => {
  const text = await (await request.get('/sitemap.xml')).text();
  expect(text).toContain('/blog/cloture-de-caisse</loc>');
  expect(text).toContain('/blog/logiciel-gestion-boutique</loc>');
  expect(text.match(/\/blog\/[a-z0-9-]+<\/loc>/g)).toHaveLength(20);
  expect(text).not.toContain('/espace');
});

test('llms.txt summarizes the product for AI assistants', async ({
  request,
}) => {
  const response = await request.get('/llms.txt');
  expect(response.headers()['content-type']).toContain('text/plain');
  const text = await response.text();
  expect(text).toMatch(/^# Nagaw Business/);
  expect(text).toContain('## Guides');
  expect(text).toContain('/blog/calcul-tva-18-ht-ttc');
});
