// Takes the landing-page screenshots (public/screens) from the real app,
// rendered against the e2e fake backend filled with a demonstration shop.
// Never touches a real database.
//
// Prerequisites (two terminals, from apps/web):
//   node e2e/support/fake-backend.mjs
//   pnpm exec next start --port 3101   (build made with the e2e env, see
//   playwright.config.ts)
// Then: node scripts/capture-screens.mjs
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from '@playwright/test';

const BACKEND = 'http://localhost:54400';
const APP = 'http://localhost:3101';
const SHOP = '11111111-1111-4111-8111-111111111111';
const OUT = new URL('../public/screens/', import.meta.url);

await fetch(`${BACKEND}/__test/reset`);
const cookie = await (await fetch(`${BACKEND}/__test/session?user=awa`)).json();
const session = JSON.parse(
  Buffer.from(cookie.value.replace(/^base64-/, ''), 'base64url').toString(),
);

async function api(method, path, body) {
  const response = await fetch(`${BACKEND}/api/v1${path}`, {
    method,
    headers: {
      authorization: `Bearer ${session.access_token}`,
      'x-organization-id': SHOP,
      'content-type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${method} ${path} → ${response.status} ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

// --- Demonstration shop ----------------------------------------------------
await api('PATCH', '/organizations/current', { name: 'Diop Électronique' });

// The fake backend starts with a grocery sample: put it away.
for (const product of await api('GET', '/products')) {
  await api('PATCH', `/products/${product.id}`, {
    status: 'archived',
    version: product.version,
  });
}
for (const item of await api('GET', '/product-categories')) {
  await api('PATCH', `/product-categories/${item.id}`, { status: 'archived' });
}

const [vat] = await api('GET', '/tax-rates');
const category = async (name, color) =>
  (await api('POST', '/product-categories', { name, color })).id;
const phones = await category('Téléphones', 'stock');
const accessories = await category('Accessoires', 'stats');
const audio = await category('Audio', 'invoices');
const computing = await category('Informatique', 'accounting');

// Name, category, sale price, purchase price, stock, low-stock threshold.
const PRODUCTS = [
  ['Samsung Galaxy A15 128 Go', phones, 115000, 98000, 6, 3],
  ['Tecno Spark 20 128 Go', phones, 89000, 76000, 8, 3],
  ['iPhone 13 128 Go reconditionné', phones, 285000, 245000, 2, 2],
  ['Itel A70 64 Go', phones, 52000, 44000, 10, 3],
  ['Chargeur rapide USB-C 25 W', accessories, 6500, 3500, 25, 8],
  ['Câble USB-C 1 m', accessories, 2000, 900, 60, 15],
  ['Verre trempé', accessories, 2500, 800, 0, 10],
  ['Batterie externe 20 000 mAh', accessories, 15000, 10500, 12, 4],
  ['Écouteurs Bluetooth Oraimo', audio, 18000, 13000, 9, 3],
  ['Enceinte JBL Go 3', audio, 32000, 25000, 4, 2],
  ['Clé USB 64 Go', computing, 6000, 3500, 20, 5],
  ['Souris sans fil', computing, 5000, 2800, 15, 5],
];
const products = {};
for (const [name, categoryId, sale, cost, stock, low] of PRODUCTS) {
  products[name] = await api('POST', '/products', {
    name,
    categoryId,
    unit: 'piece',
    salePrice: sale,
    purchasePrice: cost,
    taxRateId: null,
    barcode: null,
    trackStock: true,
    lowStockThreshold: low,
    initialStock: stock > 0 ? stock : null,
    clientOperationId: randomUUID(),
  });
}

const customer = async (name, phone, creditLimit = null) =>
  (
    await api('POST', '/customers', {
      name,
      phone,
      creditLimit,
      clientOperationId: randomUUID(),
    })
  ).id;
const moussa = await customer('Moussa Diallo', '77 412 58 63', 100000);
await customer('Aminata Fall', '76 908 21 47');
const cabinet = await customer('Cabinet Ndiaye & Associés', '33 821 45 90');

async function sell(lines, payment, customerId = null) {
  const total = lines.reduce(
    (sum, [name, quantity]) => sum + products[name].salePrice * quantity,
    0,
  );
  const payments =
    payment === 'cash'
      ? [{ method: 'cash', amount: total, provider: null, reference: '' }]
      : payment === 'credit'
        ? [{ method: 'credit', amount: total, provider: null, reference: '' }]
        : [
            {
              method: 'mobile_money',
              amount: total,
              provider: payment,
              reference: `TX${Math.floor(Math.random() * 1e8)}`,
            },
          ];
  return api('POST', '/sales', {
    clientOperationId: randomUUID(),
    customerId,
    lines: lines.map(([name, quantity]) => ({
      productId: products[name].id,
      quantity,
    })),
    discount: 0,
    payments,
    cashReceived:
      payment === 'cash' ? Math.ceil(total / 1000) * 1000 || total : null,
    expectedTotal: total,
  });
}

await sell(
  [
    ['Samsung Galaxy A15 128 Go', 1],
    ['Chargeur rapide USB-C 25 W', 1],
  ],
  'wave',
);
await sell(
  [
    ['Câble USB-C 1 m', 2],
    ['Écouteurs Bluetooth Oraimo', 1],
  ],
  'cash',
);
await sell([['Tecno Spark 20 128 Go', 1]], 'orange_money');
await sell(
  [
    ['Batterie externe 20 000 mAh', 1],
    ['Câble USB-C 1 m', 1],
  ],
  'cash',
);
await sell([['Itel A70 64 Go', 1]], 'credit', moussa);
await sell([['Enceinte JBL Go 3', 1]], 'wave');
await sell(
  [
    ['Clé USB 64 Go', 2],
    ['Souris sans fil', 1],
  ],
  'cash',
);

const { accounts } = await api('GET', '/treasury');
const account = (provider) => accounts.find((a) => a.provider === provider).id;
const expenseCategories = await api('GET', '/expense-categories');
const expenseCategory = (name) =>
  expenseCategories.find((c) => c.name === name).id;
const today = new Date().toISOString().slice(0, 10);
for (const [label, categoryName, provider, amount] of [
  ['Transport depuis le grossiste', 'Autres dépenses', null, 3000],
  ['Facture Senelec', 'Eau et électricité', 'wave', 12000],
]) {
  await api('POST', '/expenses', {
    categoryId: expenseCategory(categoryName),
    cashAccountId: account(provider),
    label,
    amount,
    occurredOn: today,
    clientOperationId: randomUUID(),
  });
}

const line = (name, quantity) => ({
  productId: products[name].id,
  label: name,
  quantity,
  unit: 'piece',
  unitPrice: products[name].salePrice,
  taxRateBasisPoints: vat.rateBasisPoints,
});
const invoice = await api('POST', '/invoices', {
  customerId: cabinet,
  lines: [
    line('Samsung Galaxy A15 128 Go', 3),
    line('Chargeur rapide USB-C 25 W', 3),
    line('Souris sans fil', 2),
  ],
  discount: 0,
  notes: 'Téléphones garantis 12 mois.',
  dueDate: null,
  clientOperationId: randomUUID(),
});
await api('POST', `/invoices/${invoice.id}/issue`, {});

// --- Screenshots -------------------------------------------------------------
// One folder per capture day and device: a new path busts the browser and
// image-optimizer caches. Update SCREENS_DIR in src/app/page.tsx after a run.
const VERSION = new Date().toISOString().slice(0, 10);
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
    : {},
);
const DEVICES = {
  mobile: { ...devices['Pixel 7'], deviceScaleFactor: 2 },
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5 },
};

for (const [device, options] of Object.entries(DEVICES)) {
  const out = new URL(`${VERSION}/${device}/`, OUT);
  await mkdir(out, { recursive: true });
  const context = await browser.newContext(options);
  await context.addCookies([{ ...cookie, url: APP }]);
  const page = await context.newPage();
  const mobile = device === 'mobile';
  const scrollTo = (y) => page.evaluate((top) => window.scrollTo(0, top), y);

  const shot = async (path, file, prepare) => {
    await page.goto(`${APP}${path}`);
    await page.waitForLoadState('networkidle');
    if (prepare) await prepare();
    await page.screenshot({ path: fileURLToPath(new URL(file, out)) });
    console.log(`✓ ${device}/${file}`);
  };

  await shot('/espace', 'accueil.png');
  await shot('/espace/vendre', 'vendre.png', async () => {
    for (const name of [
      'Samsung Galaxy A15 128 Go',
      'Chargeur rapide USB-C 25 W',
      'Écouteurs Bluetooth Oraimo',
    ]) {
      await page.getByRole('button', { name }).first().click();
    }
    // On a phone, the three phones in 128 Go, the selected one among them;
    // the desktop grid has room for the whole catalogue.
    if (mobile) {
      await page.getByPlaceholder('Chercher un produit').fill('128 Go');
    }
    await scrollTo(0);
  });
  // The phones, filtered by category, from the filters down on a phone.
  await shot(`/espace/produits?categorie=${phones}`, 'produits.png', () =>
    scrollTo(mobile ? 290 : 0),
  );
  // Starts at the figures rather than at the period picker.
  await shot('/espace/statistiques', 'statistiques.png', () =>
    page.evaluate(
      (offset) => {
        const card = [...document.querySelectorAll('h2')].find((h) =>
          h.textContent.includes('essentiel'),
        );
        window.scrollTo(
          0,
          card.getBoundingClientRect().top + window.scrollY - offset,
        );
      },
      mobile ? 96 : 32,
    ),
  );
  // Lines and totals rather than the page title on a phone.
  await shot(`/espace/factures/${invoice.id}`, 'facture.png', () =>
    scrollTo(mobile ? 160 : 0),
  );
  await context.close();
}

await browser.close();
