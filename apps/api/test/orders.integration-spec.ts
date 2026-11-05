import { randomUUID } from 'node:crypto';
import type { TestContext, TestUser } from './support/app.js';
import { createTestContext } from './support/app.js';

/** Catalogue in a link and orders from a distance (ADR-063). */
describe('Public catalogue and orders', () => {
  let ctx: TestContext;
  let alice: TestUser; // owner of Acme
  let bob: TestUser; // owner of Globex, stranger to Acme
  let carol: TestUser; // seller at Acme
  let dan: TestUser; // reader (accountant) at Acme
  let acmeId: string;
  let acmeSlug: string;
  let globexId: string;
  let globexSlug: string;
  let water: { id: string };
  let soap: { id: string }; // out of stock
  let secret: { id: string }; // not sold online
  let delivery: { id: string }; // a service

  const as = (user: TestUser, orgId: string) => ({
    Authorization: `Bearer ${user.token}`,
    'X-Organization-Id': orgId,
  });
  const get = (user: TestUser, orgId: string, path: string) =>
    ctx.http().get(`/api/v1${path}`).set(as(user, orgId));
  const post = (user: TestUser, orgId: string, path: string, body = {}) =>
    ctx.http().post(`/api/v1${path}`).set(as(user, orgId)).send(body);
  const put = (user: TestUser, orgId: string, path: string, body: object) =>
    ctx.http().put(`/api/v1${path}`).set(as(user, orgId)).send(body);
  const catalog = (slug: string) =>
    ctx.http().get(`/api/v1/public/shops/${slug}`);
  const order = (slug: string, body: object) =>
    ctx.http().post(`/api/v1/public/shops/${slug}/orders`).send(body);
  const phone = () =>
    `77 ${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;
  const anOrder = (body: object = {}) => ({
    name: 'Awa Diop',
    phone: phone(),
    area: 'Médina, rue 11',
    lines: [{ productId: water.id, quantity: 3 }],
    expectedTotal: 1500,
    ...body,
  });
  const settings = {
    published: true,
    waveNumber: '76 000 00 00',
    orangeMoneyNumber: '',
    note: 'Livraison à Dakar',
  };

  beforeAll(async () => {
    ctx = await createTestContext();
    [alice, bob, carol, dan] = await Promise.all([
      ctx.createUser(),
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
          .send({ name, phone: '77 111 22 33' })
          .expect(201)
      ).body as { id: string; slug: string; hiddenModules: string[] };
    const acme = await createOrg(alice, 'Acme Mode');
    // A new shop starts without the module: it opens a public page.
    expect(acme.hiddenModules).toEqual(['orders']);
    acmeId = acme.id;
    acmeSlug = acme.slug;
    const globex = await createOrg(bob, 'Globex');
    globexId = globex.id;
    globexSlug = globex.slug;
    await ctx.admin.query(
      `insert into app.organization_memberships (organization_id, user_id, role)
       values ($1, $2, 'member'), ($1, $3, 'viewer')`,
      [acmeId, carol.id, dan.id],
    );
    const product = async (fields: object, user = alice, orgId = acmeId) =>
      (
        await post(user, orgId, '/products', {
          categoryId: null,
          purchasePrice: null,
          taxRateId: null,
          barcode: null,
          lowStockThreshold: null,
          trackStock: true,
          unit: 'piece',
          clientOperationId: randomUUID(),
          ...fields,
        }).expect((r) => {
          if (r.status !== 201) throw new Error(JSON.stringify(r.body));
        })
      ).body as { id: string };
    water = await product({
      name: 'Eau 1,5 L',
      salePrice: 500,
      purchasePrice: 300,
      initialStock: 20,
    });
    soap = await product({ name: 'Savon', salePrice: 400 });
    secret = await product({
      name: 'Article réservé',
      salePrice: 900,
      initialStock: 5,
    });
    delivery = await product({
      name: 'Retouche',
      salePrice: 2000,
      trackStock: false,
    });
    await ctx.admin.query(
      'update app.products set sold_online = false where id = $1',
      [secret.id],
    );
    await product(
      { name: 'Produit Globex', salePrice: 100, initialStock: 5 },
      bob,
      globexId,
    );
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('public page', () => {
    it('stays closed until the shop shows the module and publishes', async () => {
      await catalog(acmeSlug).expect(404);
      // Publishing with the module hidden is refused.
      await put(alice, acmeId, '/orders/settings', settings).expect(400);
      await put(alice, acmeId, '/organizations/current/modules', {
        hiddenModules: [],
      }).expect(200);
      await put(alice, acmeId, '/orders/settings', {
        ...settings,
        published: false,
      }).expect(200);
      await catalog(acmeSlug).expect(404);
      const res = await put(alice, acmeId, '/orders/settings', settings).expect(
        200,
      );
      expect(res.body).toMatchObject({
        slug: acmeSlug,
        published: true,
        ordersThisMonth: 0,
        maxOrdersPerMonth: 30,
      });
    });

    it('shows only what a customer may see', async () => {
      const res = await catalog(acmeSlug).expect(200);
      expect(res.body.shop).toEqual({
        slug: acmeSlug,
        name: 'Acme Mode',
        currency: 'XOF',
        phoneCountryCode: '221',
        phone: '77 111 22 33',
        logoVersion: null,
        note: 'Livraison à Dakar',
        payment: { wave: '76 000 00 00', orangeMoney: null },
      });
      const names = res.body.products.map((p: { name: string }) => p.name);
      expect(names).toEqual(['Eau 1,5 L', 'Retouche', 'Savon']);
      const byName = Object.fromEntries(
        res.body.products.map((p: { name: string }) => [p.name, p]),
      );
      expect(byName['Savon'].available).toBe(false);
      expect(byName['Retouche'].available).toBe(true);
      expect(Object.keys(byName['Eau 1,5 L']).sort()).toEqual(
        [
          'available',
          'category',
          'id',
          'name',
          'photoVersion',
          'price',
          'unit',
        ].sort(),
      );
      // Never the purchase price, the stock, a customer or a figure.
      const raw = JSON.stringify(res.body);
      for (const hidden of ['purchase', 'stock', 'Quantity', 'customer'])
        expect(raw).not.toContain(hidden);
    });

    it('answers the same for a shop that does not exist', async () => {
      const missing = await catalog('nope-000000').expect(404);
      const closed = await catalog(globexSlug).expect(404);
      expect(missing.body.error.code).toBe('SHOP_NOT_FOUND');
      const { code, message } = missing.body.error;
      expect(closed.body.error).toMatchObject({ code, message });
      await ctx.http().get('/api/v1/public/shops/Bad%20Slug').expect(404);
    });

    it('serves the photo of a product sold online only', async () => {
      await ctx
        .http()
        .get(`/api/v1/public/shops/${acmeSlug}/products/${secret.id}/photo`)
        .expect(404);
      await ctx
        .http()
        .get(`/api/v1/public/shops/${acmeSlug}/products/not-a-uuid/photo`)
        .expect(404);
    });
  });

  describe('ordering', () => {
    it('takes an order at the prices shown, with a reference', async () => {
      const res = await order(
        acmeSlug,
        anOrder({
          lines: [
            { productId: water.id, quantity: 3 },
            { productId: delivery.id, quantity: 1 },
          ],
          expectedTotal: 3500,
          note: 'Appeler avant',
        }),
      ).expect(201);
      expect(res.body.reference).toMatch(/^CMD-[0-9A-Z]{6}$/);
      expect(res.body).toMatchObject({
        total: 3500,
        currency: 'XOF',
        lines: [
          { label: 'Eau 1,5 L', quantity: 3, lineTotal: 1500 },
          { label: 'Retouche', quantity: 1, lineTotal: 2000 },
        ],
        shop: { name: 'Acme Mode', payment: { wave: '76 000 00 00' } },
      });
      // Nothing leaves the stock before the delivery.
      const product = await get(alice, acmeId, `/products/${water.id}`).expect(
        200,
      );
      expect(product.body.stockQuantity).toBe(20);
      const audit = await ctx.admin.query(
        `select actor_type, actor_id from app.audit_logs
          where organization_id = $1 and action = 'order.received'`,
        [acmeId],
      );
      expect(audit.rows).toEqual([{ actor_type: 'system', actor_id: null }]);
    });

    it('refuses what cannot be sold online', async () => {
      for (const [lines, expectedTotal] of [
        [[{ productId: soap.id, quantity: 1 }], 400],
        [[{ productId: secret.id, quantity: 1 }], 900],
        [[{ productId: randomUUID(), quantity: 1 }], 0],
      ] as const) {
        const res = await order(
          acmeSlug,
          anOrder({ lines, expectedTotal }),
        ).expect(400);
        expect(res.body.error.details[0].path).toBe('lines.0.productId');
      }
      // A product of another shop is unknown here.
      const globexProduct = await ctx.admin.query(
        'select id from app.products where organization_id = $1',
        [globexId],
      );
      await order(
        acmeSlug,
        anOrder({
          lines: [{ productId: globexProduct.rows[0].id, quantity: 1 }],
          expectedTotal: 100,
        }),
      ).expect(400);
    });

    it('tells the customer when a price changed', async () => {
      const res = await order(
        acmeSlug,
        anOrder({ expectedTotal: 1000 }),
      ).expect(409);
      expect(res.body.error.code).toBe('PRICE_CHANGED');
    });

    it('checks the phone number', async () => {
      const res = await order(
        acmeSlug,
        anOrder({ phone: '12345678901234567' }),
      ).expect(400);
      expect(res.body.error.details[0].path).toBe('phone');
    });

    it('limits the orders of a phone in an hour', async () => {
      const number = phone();
      for (let i = 0; i < 5; i += 1)
        await order(acmeSlug, anOrder({ phone: number })).expect(201);
      const res = await order(acmeSlug, anOrder({ phone: number })).expect(429);
      expect(res.body.error.code).toBe('TOO_MANY_ORDERS');
    });

    it('limits the orders of a free shop in a month', async () => {
      // 1 + 5 orders so far; the limit lives in the plan.
      await ctx.admin.query(
        `update app.plans set max_orders_per_month = 7 where key = 'free'`,
      );
      await order(acmeSlug, anOrder()).expect(201);
      const res = await order(acmeSlug, anOrder()).expect(409);
      expect(res.body.error.code).toBe('ORDER_LIMIT_REACHED');
      await ctx.admin.query(
        `update app.plans set max_orders_per_month = 30 where key = 'free'`,
      );
    });
  });

  describe('shop side', () => {
    let first: { id: string; reference: string };

    it('lists the orders to handle, with their counts', async () => {
      const list = await get(alice, acmeId, '/orders?view=new').expect(200);
      expect(list.body).toHaveLength(7);
      first = list.body.at(-1);
      expect(list.body.at(-1)).toMatchObject({
        status: 'new',
        customerName: 'Awa Diop',
        customerArea: 'Médina, rue 11',
        customerNote: 'Appeler avant',
        total: 3500,
        paidAt: null,
      });
      expect(list.body.at(-1).customerPhone).toMatch(/^22177\d{7}$/);
      const counts = await get(alice, acmeId, '/orders/counts').expect(200);
      expect(counts.body).toEqual({ new: 7, open: 7, remind: 0 });
    });

    it('follows the steps, and refuses one out of order', async () => {
      const wrong = await post(carol, acmeId, `/orders/${first.id}/deliver`, {
        payment: { method: 'cash' },
      }).expect(409);
      expect(wrong.body.error.code).toBe('ORDER_WRONG_STEP');
      await post(carol, acmeId, `/orders/${first.id}/confirm`).expect(201);
      const counts = await get(alice, acmeId, '/orders/counts').expect(200);
      expect(counts.body.remind).toBe(1);
      const shipped = await post(carol, acmeId, `/orders/${first.id}/ship`, {
        courierName: 'Moussa',
        courierPhone: '78 000 11 22',
        deliveryFee: 1000,
      }).expect(201);
      expect(shipped.body).toMatchObject({
        status: 'shipping',
        courierName: 'Moussa',
        courierPhone: '221780001122',
        deliveryFee: 1000,
      });
    });

    it('records the payment once', async () => {
      const paid = await post(carol, acmeId, `/orders/${first.id}/pay`, {
        method: 'mobile_money',
        provider: 'wave',
        reference: 'TX-42',
      }).expect(201);
      expect(paid.body.payment).toEqual({
        method: 'mobile_money',
        provider: 'wave',
        reference: 'TX-42',
      });
      const again = await post(carol, acmeId, `/orders/${first.id}/pay`, {
        method: 'cash',
      }).expect(409);
      expect(again.body.error.code).toBe('ORDER_ALREADY_PAID');
    });

    it('becomes a sale at delivery, once', async () => {
      const delivered = await post(
        carol,
        acmeId,
        `/orders/${first.id}/deliver`,
      ).expect(201);
      expect(delivered.body.status).toBe('delivered');
      const saleId = delivered.body.saleId as string;
      const sale = await get(alice, acmeId, `/sales/${saleId}`).expect(200);
      expect(sale.body.total).toBe(3500);
      expect(sale.body.payments[0]).toMatchObject({
        method: 'mobile_money',
        provider: 'wave',
        amount: 3500,
      });
      const product = await get(alice, acmeId, `/products/${water.id}`).expect(
        200,
      );
      expect(product.body.stockQuantity).toBe(17);
      // A second click finds a closed order; the stock moved once.
      const again = await post(
        carol,
        acmeId,
        `/orders/${first.id}/deliver`,
      ).expect(409);
      expect(again.body.error.code).toBe('ORDER_CLOSED');
      const sales = await ctx.admin.query(
        'select count(*)::int as n from app.sales where organization_id = $1',
        [acmeId],
      );
      expect(sales.rows[0].n).toBe(1);
    });

    it('takes the payment at delivery for an unpaid order', async () => {
      const [next] = (await get(alice, acmeId, '/orders?view=new').expect(200))
        .body;
      await post(alice, acmeId, `/orders/${next.id}/confirm`).expect(201);
      const missing = await post(
        alice,
        acmeId,
        `/orders/${next.id}/deliver`,
      ).expect(400);
      expect(missing.body.error.details[0].path).toBe('payment');
      const delivered = await post(
        alice,
        acmeId,
        `/orders/${next.id}/deliver`,
        { payment: { method: 'cash' } },
      ).expect(201);
      expect(delivered.body.payment).toMatchObject({ method: 'cash' });
      expect(delivered.body.paidAt).not.toBeNull();
    });

    it('cancels with a reason, and nothing more after', async () => {
      const [next] = (await get(alice, acmeId, '/orders?view=new').expect(200))
        .body;
      await post(alice, acmeId, `/orders/${next.id}/cancel`, {
        reason: '',
      }).expect(400);
      const cancelled = await post(alice, acmeId, `/orders/${next.id}/cancel`, {
        reason: 'Client injoignable',
      }).expect(201);
      expect(cancelled.body).toMatchObject({
        status: 'cancelled',
        cancelReason: 'Client injoignable',
      });
      await post(alice, acmeId, `/orders/${next.id}/confirm`).expect(409);
    });

    it('keeps the orders to the people of the shop who handle them', async () => {
      // A reader sees nothing of the orders, and changes nothing.
      await get(dan, acmeId, '/orders').expect(403);
      await post(dan, acmeId, `/orders/${first.id}/cancel`, {
        reason: 'x',
      }).expect(403);
      // A seller handles orders but not the settings of the page.
      await get(carol, acmeId, '/orders').expect(200);
      await get(carol, acmeId, '/orders/settings').expect(403);
      await put(carol, acmeId, '/orders/settings', settings).expect(403);
    });

    it('never shows nor touches the orders of another shop', async () => {
      const res = await get(bob, globexId, '/orders?view=all').expect(200);
      expect(res.body).toEqual([]);
      await get(bob, globexId, `/orders/${first.id}`).expect(404);
      const bodies: Record<string, object> = {
        confirm: {},
        cancel: { reason: 'Essai' },
        pay: { method: 'cash' },
        ship: { courierName: '', courierPhone: '', deliveryFee: 0 },
        deliver: { payment: { method: 'cash' } },
      };
      for (const [action, body] of Object.entries(bodies)) {
        const r = await post(
          bob,
          globexId,
          `/orders/${first.id}/${action}`,
          body,
        );
        expect({ action, status: r.status, code: r.body.error?.code }).toEqual({
          action,
          status: 404,
          code: 'ORDER_NOT_FOUND',
        });
      }
      // Naming Acme with Bob's session: as if it did not exist.
      const foreign = await get(bob, acmeId, '/orders').expect(404);
      expect(foreign.body.error.code).toBe('ORGANIZATION_NOT_FOUND');
      // Globex's counts are its own.
      const counts = await get(bob, globexId, '/orders/counts').expect(200);
      expect(counts.body).toEqual({ new: 0, open: 0, remind: 0 });
    });
  });
});
