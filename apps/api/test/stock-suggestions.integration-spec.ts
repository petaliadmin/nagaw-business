import { randomUUID } from 'node:crypto';
import type { TestContext, TestUser } from './support/app.js';
import { createTestContext } from './support/app.js';

/** « Compter le stock de … ? » on the home page (ADR-070). */
describe('Stock suggestions', () => {
  let ctx: TestContext;
  let alice: TestUser; // owner of Acme
  let bob: TestUser; // owner of Globex
  let carol: TestUser; // seller of Acme
  let acmeId: string;
  let globexId: string;
  let bread: { id: string }; // not counted, sold often
  let milk: { id: string }; // not counted, sold once
  let water: { id: string }; // counted

  const as = (user: TestUser, orgId: string) => ({
    Authorization: `Bearer ${user.token}`,
    'X-Organization-Id': orgId,
  });
  const get = (user: TestUser, orgId: string, path: string) =>
    ctx.http().get(`/api/v1${path}`).set(as(user, orgId));
  const post = (user: TestUser, orgId: string, path: string, body: object) =>
    ctx.http().post(`/api/v1${path}`).set(as(user, orgId)).send(body);
  const product = async (fields: object) =>
    (
      await post(alice, acmeId, '/products', {
        categoryId: null,
        purchasePrice: null,
        taxRateId: null,
        barcode: null,
        lowStockThreshold: null,
        unit: 'piece',
        salePrice: 100,
        clientOperationId: randomUUID(),
        ...fields,
      }).expect(201)
    ).body;
  const sell = (productId: string) =>
    post(alice, acmeId, '/sales', {
      clientOperationId: randomUUID(),
      lines: [{ productId, quantity: 1 }],
      payments: [{ method: 'cash', amount: 100 }],
      expectedTotal: 100,
    }).expect(201);
  const suggested = async (user = alice, orgId = acmeId) =>
    (
      (await get(user, orgId, '/stock/suggestions').expect(200)).body as {
        productId: string;
      }[]
    ).map((s) => s.productId);

  beforeAll(async () => {
    ctx = await createTestContext();
    [alice, bob, carol] = await Promise.all([
      ctx.createUser(),
      ctx.createUser(),
      ctx.createUser(),
    ]);
    const createOrg = async (user: TestUser, name: string) =>
      (
        await ctx
          .http()
          .post('/api/v1/organizations')
          .set({ Authorization: `Bearer ${user.token}` })
          .send({ name })
          .expect(201)
      ).body.id as string;
    acmeId = await createOrg(alice, 'Acme Dakar');
    globexId = await createOrg(bob, 'Globex');
    await ctx.admin.query(
      `insert into app.organization_memberships (organization_id, user_id, role)
       values ($1, $2, 'member')`,
      [acmeId, carol.id],
    );
    bread = await product({ name: 'Pain', trackStock: false });
    milk = await product({ name: 'Lait', trackStock: false });
    water = await product({ name: 'Eau', trackStock: true, initialStock: 50 });
    for (let i = 0; i < 5; i++) {
      await sell(bread.id);
      await sell(water.id);
    }
    await sell(milk.id);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('suggests a product not counted, sold in enough sales', async () => {
    const list = (await get(alice, acmeId, '/stock/suggestions').expect(200))
      .body;
    expect(list).toEqual([
      {
        productId: bread.id,
        name: 'Pain',
        unit: 'piece',
        sales: 5,
        windowDays: 14,
      },
    ]);
  });

  it('follows the thresholds of the shop', async () => {
    await ctx.admin.query(
      'update app.organizations set stock_suggestion_min_sales = 1 where id = $1',
      [acmeId],
    );
    expect(await suggested()).toEqual([bread.id, milk.id]);
    await ctx.admin.query(
      'update app.organizations set stock_suggestion_min_sales = 5 where id = $1',
      [acmeId],
    );
    expect(await suggested()).toEqual([bread.id]);
  });

  it('asks again later, or never, as chosen', async () => {
    await post(alice, acmeId, `/stock/suggestions/${bread.id}/dismiss`, {
      choice: 'later',
    }).expect(204);
    expect(await suggested()).toEqual([]);
    // The days have passed.
    await ctx.admin.query(
      `update app.stock_suggestion_dismissals set until = now() - interval '1 minute'
        where product_id = $1`,
      [bread.id],
    );
    expect(await suggested()).toEqual([bread.id]);
    await post(alice, acmeId, `/stock/suggestions/${bread.id}/dismiss`, {
      choice: 'never',
    }).expect(204);
    expect(await suggested()).toEqual([]);
    const { rows } = await ctx.admin.query(
      `select count(*) from app.audit_logs
        where organization_id = $1 and action = 'stock_suggestion.dismissed'`,
      [acmeId],
    );
    expect(Number(rows[0].count)).toBe(2);
  });

  it('is for those who can count the stock, in their own shop only', async () => {
    await get(carol, acmeId, '/stock/suggestions').expect(403);
    await post(carol, acmeId, `/stock/suggestions/${milk.id}/dismiss`, {
      choice: 'never',
    }).expect(403);
    expect(await suggested(bob, globexId)).toEqual([]);
    await post(bob, globexId, `/stock/suggestions/${milk.id}/dismiss`, {
      choice: 'never',
    }).expect(404);
    await post(alice, acmeId, `/stock/suggestions/${milk.id}/dismiss`, {
      choice: 'sometimes',
    }).expect(400);
    await post(alice, acmeId, '/stock/suggestions/not-a-uuid/dismiss', {
      choice: 'never',
    }).expect(404);
  });
});
