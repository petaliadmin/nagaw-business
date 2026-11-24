import { randomUUID } from 'node:crypto';
import type { TestContext, TestUser } from './support/app.js';
import { createTestContext } from './support/app.js';

/** « Vente au montant » and prices typed at each sale (ADR-069). */
describe('Open prices', () => {
  let ctx: TestContext;
  let alice: TestUser; // owner of Acme
  let bob: TestUser; // owner of Globex (a services shop)
  let acmeId: string;
  let globexId: string;
  let amount: { id: string }; // Acme's « Vente au montant »
  let globexAmount: { id: string };
  let fish: { id: string }; // price typed at each sale
  let water: { id: string }; // 500 F

  const as = (user: TestUser, orgId: string) => ({
    Authorization: `Bearer ${user.token}`,
    'X-Organization-Id': orgId,
  });
  const get = (user: TestUser, orgId: string, path: string) =>
    ctx.http().get(`/api/v1${path}`).set(as(user, orgId));
  const post = (user: TestUser, orgId: string, path: string, body: object) =>
    ctx.http().post(`/api/v1${path}`).set(as(user, orgId)).send(body);
  const patch = (user: TestUser, orgId: string, path: string, body: object) =>
    ctx.http().patch(`/api/v1${path}`).set(as(user, orgId)).send(body);

  const sell = (lines: object[], total: number, user = alice, orgId = acmeId) =>
    post(user, orgId, '/sales', {
      clientOperationId: randomUUID(),
      lines,
      payments: [{ method: 'cash', amount: total }],
      expectedTotal: total,
    });
  const product = async (fields: object, user = alice, orgId = acmeId) =>
    (
      await post(user, orgId, '/products', {
        categoryId: null,
        purchasePrice: null,
        taxRateId: null,
        barcode: null,
        lowStockThreshold: null,
        trackStock: false,
        unit: 'piece',
        clientOperationId: randomUUID(),
        ...fields,
      }).expect(201)
    ).body;
  const systemProduct = async (user: TestUser, orgId: string) => {
    const all = (
      await get(user, orgId, '/products?limit=100&system=include').expect(200)
    ).body as { id: string; systemRole: string | null }[];
    return all.filter((p) => p.systemRole === 'open_sale');
  };

  beforeAll(async () => {
    ctx = await createTestContext();
    [alice, bob] = await Promise.all([ctx.createUser(), ctx.createUser()]);
    const createOrg = async (user: TestUser, body: object) =>
      (
        await ctx
          .http()
          .post('/api/v1/organizations')
          .set({ Authorization: `Bearer ${user.token}` })
          .send(body)
          .expect(201)
      ).body.id as string;
    acmeId = await createOrg(alice, { name: 'Acme Dakar' });
    globexId = await createOrg(bob, { name: 'Globex', offer: 'services' });
    fish = await product({
      name: 'Poisson',
      salePrice: 0,
      openPrice: true,
    });
    water = await product({ name: 'Eau', salePrice: 500 });
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('gives every new shop one « Vente au montant », fitting its offer', async () => {
    const acme = await systemProduct(alice, acmeId);
    const globex = await systemProduct(bob, globexId);
    expect(acme).toHaveLength(1);
    expect(globex).toHaveLength(1);
    expect(acme[0]).toMatchObject({
      name: 'Vente au montant',
      openPrice: true,
      trackStock: false,
      kind: 'product',
      status: 'active',
    });
    expect(globex[0]).toMatchObject({ kind: 'service', unit: 'prestation' });
    amount = acme[0]!;
    globexAmount = globex[0]!;
    // The catalogue does not list it.
    const listed = (await get(alice, acmeId, '/products').expect(200)).body as {
      id: string;
    }[];
    expect(listed.map((p) => p.id)).not.toContain(amount.id);
    // Each shop sees its own one only.
    await get(bob, globexId, `/products/${amount.id}`).expect(404);
    await get(alice, acmeId, `/products/${globexAmount.id}`).expect(404);
  });

  it('keeps « Vente au montant » usable and out of the product limit', async () => {
    const { version } = (
      await get(alice, acmeId, `/products/${amount.id}`).expect(200)
    ).body as { version: number };
    for (const body of [
      { status: 'archived' },
      { openPrice: false },
      { trackStock: true },
    ]) {
      const res = await patch(alice, acmeId, `/products/${amount.id}`, {
        ...body,
        version,
      }).expect(409);
      expect(res.body.error.code).toBe('SYSTEM_PRODUCT');
    }
    const usage = (await get(alice, acmeId, '/subscription').expect(200)).body
      .usage.products;
    // Poisson and Eau, not « Vente au montant ».
    expect(usage).toBe(2);
  });

  it('sells an amount with what the seller typed, at the typed price', async () => {
    const res = await sell(
      [
        { productId: amount.id, quantity: 1, agreedTotal: 1500, label: 'Pain' },
        { productId: water.id, quantity: 1 },
      ],
      2000,
    ).expect(201);
    expect(res.body.total).toBe(2000);
    expect(res.body.discount ?? 0).toBe(0);
    expect(
      res.body.lines.map((l: { label: string; lineTotal: number }) => [
        l.label,
        l.lineTotal,
      ]),
    ).toEqual([
      ['Pain', 1500],
      ['Eau', 500],
    ]);
    // Nothing typed: the line keeps the product's name.
    const plain = await sell(
      [{ productId: amount.id, quantity: 1, agreedTotal: 700 }],
      700,
    ).expect(201);
    expect(plain.body.lines[0].label).toBe('Vente au montant');
  });

  it('prices a typed-price product from what was typed, for several pieces', async () => {
    const res = await sell(
      [{ productId: fish.id, quantity: 2, agreedTotal: 3000 }],
      3000,
    ).expect(201);
    expect(res.body.lines[0]).toMatchObject({
      label: 'Poisson',
      unitPrice: 1500,
      lineTotal: 3000,
    });
  });

  it('refuses a typed price missing, or a name typed on an ordinary product', async () => {
    const missing = await sell(
      [
        { productId: fish.id, quantity: 1 },
        { productId: water.id, quantity: 1 },
      ],
      500,
    ).expect(400);
    expect(JSON.stringify(missing.body)).toContain('Tapez le prix');
    const named = await sell(
      [{ productId: water.id, quantity: 1, label: 'Autre nom' }],
      500,
    ).expect(400);
    expect(JSON.stringify(named.body)).toContain('garde son nom');
  });

  it('accepts an amount typed offline, with no price to review', async () => {
    const device = (
      await post(alice, acmeId, '/devices', {
        label: 'Comptoir',
        clientOperationId: randomUUID(),
      }).expect(201)
    ).body as { id: string; ticketPrefix: string };
    const res = await post(alice, acmeId, '/sync', {
      deviceId: device.id,
      operations: [
        {
          type: 'sale',
          clientOperationId: randomUUID(),
          data: {
            deviceTicket: `${device.ticketPrefix}-000001`,
            occurredAt: new Date(Date.now() - 60_000).toISOString(),
            lines: [
              {
                productId: amount.id,
                quantity: 1,
                unitPrice: 2500,
                label: 'Savon',
              },
            ],
            payments: [{ method: 'cash', amount: 2500 }],
          },
        },
      ],
    }).expect(200);
    expect(res.body.results[0]).toMatchObject({
      status: 'accepted',
      priceReview: false,
    });
    const sale = (
      await get(alice, acmeId, `/sales/${res.body.results[0].saleId}`).expect(
        200,
      )
    ).body;
    expect(sale.lines[0]).toMatchObject({ label: 'Savon', lineTotal: 2500 });
  });

  it('never sells the « Vente au montant » of another shop', async () => {
    await sell(
      [{ productId: globexAmount.id, quantity: 1, agreedTotal: 100 }],
      100,
    ).expect(400);
  });
});
