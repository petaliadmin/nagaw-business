import { randomUUID } from 'node:crypto';
import type { TestContext, TestUser } from './support/app.js';
import { createTestContext } from './support/app.js';

describe('Sales and customers', () => {
  let ctx: TestContext;
  let alice: TestUser; // owner of Acme
  let bob: TestUser; // owner of Globex
  let carol: TestUser; // seller (member) of Acme
  let dan: TestUser; // reader (viewer) of Acme
  let acmeId: string;
  let globexId: string;
  let water: { id: string }; // 500 F, tax 18 %, stock 20
  let rice: { id: string }; // 1 200 F the kg, stock 10 kg
  let service: { id: string }; // 2 000 F, stock not tracked
  let globexProduct: { id: string };

  const as = (user: TestUser, orgId: string) => ({
    Authorization: `Bearer ${user.token}`,
    'X-Organization-Id': orgId,
  });
  const get = (user: TestUser, orgId: string, path: string) =>
    ctx.http().get(`/api/v1${path}`).set(as(user, orgId));
  const post = (user: TestUser, orgId: string, path: string, body: object) =>
    ctx.http().post(`/api/v1${path}`).set(as(user, orgId)).send(body);

  const sell = (body: Record<string, unknown>, user = alice, orgId = acmeId) =>
    post(user, orgId, '/sales', {
      clientOperationId: randomUUID(),
      ...body,
    });
  const cashSale = (lines: object[], total: number, user = alice) =>
    sell(
      {
        lines,
        payments: [{ method: 'cash', amount: total }],
        expectedTotal: total,
      },
      user,
    );
  const stockOf = async (productId: string) =>
    (await get(alice, acmeId, `/products/${productId}`).expect(200)).body
      .stockQuantity as number;
  const newCustomer = async (body: object = {}, user = alice, orgId = acmeId) =>
    (
      await post(user, orgId, '/customers', {
        name: `Client ${randomUUID().slice(0, 6)}`,
        clientOperationId: randomUUID(),
        ...body,
      }).expect(201)
    ).body;

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
          .send({ name })
          .expect(201)
      ).body.id as string;
    acmeId = await createOrg(alice, 'Acme Dakar');
    globexId = await createOrg(bob, 'Globex');
    await ctx.admin.query(
      `insert into app.organization_memberships (organization_id, user_id, role)
       values ($1, $2, 'member'), ($1, $3, 'viewer')`,
      [acmeId, carol.id, dan.id],
    );
    const tax = (
      await post(alice, acmeId, '/tax-rates', {
        name: 'TVA',
        rateBasisPoints: 1800,
      }).expect(201)
    ).body;
    const product = async (fields: object, user = alice, orgId = acmeId) =>
      (
        await post(user, orgId, '/products', {
          categoryId: null,
          purchasePrice: null,
          taxRateId: null,
          barcode: null,
          lowStockThreshold: null,
          trackStock: true,
          clientOperationId: randomUUID(),
          ...fields,
        }).expect(201)
      ).body;
    water = await product({
      name: 'Eau 1,5 L',
      unit: 'bouteille',
      salePrice: 500,
      taxRateId: tax.id,
      initialStock: 20,
    });
    rice = await product({
      name: 'Riz',
      unit: 'kg',
      salePrice: 1200,
      initialStock: 10,
    });
    service = await product({
      name: 'Recharge téléphone',
      unit: 'piece',
      salePrice: 2000,
      trackStock: false,
    });
    globexProduct = await product(
      {
        name: 'Produit Globex',
        unit: 'piece',
        salePrice: 100,
        initialStock: 5,
      },
      bob,
      globexId,
    );
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('recording a sale', () => {
    it('prices from the catalogue, takes the goods out of stock and gives change', async () => {
      const res = await sell({
        lines: [
          { productId: water.id, quantity: 3 },
          { productId: rice.id, quantity: 0.5 },
          { productId: service.id, quantity: 1 },
        ],
        payments: [{ method: 'cash', amount: 4100 }],
        cashReceived: 5000,
        expectedTotal: 4100,
      }).expect(201);
      expect(res.body).toMatchObject({
        saleNumber: 1,
        status: 'completed',
        subtotal: 4100,
        total: 4100,
        // 1 500 TTC at 18 % includes 229.
        taxTotal: 229,
        cashReceived: 5000,
        changeGiven: 900,
        seller: { userId: alice.id },
      });
      expect(
        res.body.lines.map((l: { label: string; lineTotal: number }) => [
          l.label,
          l.lineTotal,
        ]),
      ).toEqual([
        ['Eau 1,5 L', 1500],
        ['Riz', 600],
        ['Recharge téléphone', 2000],
      ]);
      expect(await stockOf(water.id)).toBe(17);
      expect(await stockOf(rice.id)).toBe(9.5);
      const { rows } = await ctx.admin.query(
        `select count(*) from app.stock_movements where sale_id = $1`,
        [res.body.id],
      );
      expect(Number(rows[0].count)).toBe(2); // not the untracked service
    });

    it('numbers tickets without gaps and answers a replay without a second sale', async () => {
      const body = {
        clientOperationId: randomUUID(),
        lines: [{ productId: water.id, quantity: 1 }],
        payments: [
          {
            method: 'mobile_money',
            amount: 500,
            provider: 'wave',
            reference: 'TX-42',
          },
        ],
        expectedTotal: 500,
      };
      const first = await post(alice, acmeId, '/sales', body).expect(201);
      const again = await post(alice, acmeId, '/sales', body).expect(200);
      expect(again.body.id).toBe(first.body.id);
      expect(first.body.saleNumber).toBe(2);
      expect(first.body.payments).toEqual([
        {
          method: 'mobile_money',
          provider: 'wave',
          reference: 'TX-42',
          amount: 500,
        },
      ]);
      expect(await stockOf(water.id)).toBe(16);
      const next = await cashSale(
        [{ productId: water.id, quantity: 1 }],
        500,
      ).expect(201);
      expect(next.body.saleNumber).toBe(3);
    });

    it('refuses a total the device computed from old prices', async () => {
      const res = await cashSale(
        [{ productId: water.id, quantity: 2 }],
        900,
      ).expect(409);
      expect(res.body.error.code).toBe('PRICE_CHANGED');
      // Intl groups thousands with a narrow no-break space.
      expect(res.body.error.message.replace(/\s/g, ' ')).toContain(
        '1 000 F CFA',
      );
    });

    it('checks payments, units, products and discounts on the server', async () => {
      // Payments must cover the total.
      await sell({
        lines: [{ productId: water.id, quantity: 1 }],
        payments: [{ method: 'cash', amount: 400 }],
        expectedTotal: 500,
      }).expect(400);
      // Whole units stay whole.
      await cashSale([{ productId: water.id, quantity: 1.5 }], 750).expect(400);
      // A product of another shop is unknown here.
      const foreign = await cashSale(
        [{ productId: globexProduct.id, quantity: 1 }],
        100,
      ).expect(400);
      expect(foreign.body.error.details[0].message).toBe(
        'Produit inconnu ou archivé.',
      );
      // No limit by default; a limit is set seller by seller (ADR-038).
      const big = {
        lines: [{ productId: service.id, quantity: 1 }],
        discount: 400,
        payments: [{ method: 'cash', amount: 1600 }],
        expectedTotal: 1600,
      };
      await sell(big, carol).expect(201);
      const limit = (maxDiscountBasisPoints: number | null) =>
        ctx
          .http()
          .patch(`/api/v1/organizations/current/members/${carol.id}`)
          .set(as(alice, acmeId))
          .send({ maxDiscountBasisPoints })
          .expect(200);
      expect((await limit(1000)).body.maxDiscountBasisPoints).toBe(1000);
      const refused = await sell(big, carol).expect(403);
      expect(refused.body.error.code).toBe('DISCOUNT_NOT_ALLOWED');
      await sell(
        {
          ...big,
          discount: 200,
          payments: [{ method: 'cash', amount: 1800 }],
          expectedTotal: 1800,
        },
        carol,
      ).expect(201);
      await sell(big, alice).expect(201);
      await limit(null);
      // The reader never sells.
      await cashSale([{ productId: water.id, quantity: 1 }], 500, dan).expect(
        403,
      );
    });

    it('lets the stock go below zero rather than refusing a sale already made', async () => {
      const before = await stockOf(rice.id);
      await cashSale(
        [{ productId: rice.id, quantity: before + 1 }],
        Math.round(1200 * (before + 1)),
      ).expect(201);
      const product = (
        await get(alice, acmeId, `/products/${rice.id}`).expect(200)
      ).body;
      expect(product).toMatchObject({ stockQuantity: -1, stockLevel: 'out' });
    });
  });

  describe('credit and customers', () => {
    it('sells on credit to a customer and tracks what they owe', async () => {
      const customer = await newCustomer({
        name: 'Awa Diop',
        phone: '77 123 45 67',
      });
      expect(customer.balance).toBe(0);
      await sell({
        lines: [{ productId: service.id, quantity: 1 }],
        payments: [{ method: 'credit', amount: 2000 }],
        expectedTotal: 2000,
      }).expect(400); // credit needs a customer
      await sell({
        customerId: customer.id,
        lines: [{ productId: service.id, quantity: 2 }],
        payments: [
          { method: 'cash', amount: 1000 },
          { method: 'credit', amount: 3000 },
        ],
        expectedTotal: 4000,
      }).expect(201);
      const owing = (
        await get(carol, acmeId, `/customers/${customer.id}`).expect(200)
      ).body;
      expect(owing.balance).toBe(3000);
      expect(owing.activity[0]).toMatchObject({
        kind: 'credit_sale',
        amount: 3000,
      });

      const repay = (body: object) =>
        post(carol, acmeId, `/customers/${customer.id}/payments`, {
          clientOperationId: randomUUID(),
          ...body,
        });
      const tooMuch = await repay({ method: 'cash', amount: 5000 }).expect(409);
      expect(tooMuch.body.error.code).toBe('REPAYMENT_TOO_HIGH');
      const body = {
        method: 'mobile_money',
        provider: 'orange_money',
        amount: 1000,
        clientOperationId: randomUUID(),
      };
      const paid = await post(
        carol,
        acmeId,
        `/customers/${customer.id}/payments`,
        body,
      ).expect(201);
      expect(paid.body.balance).toBe(2000);
      await post(
        carol,
        acmeId,
        `/customers/${customer.id}/payments`,
        body,
      ).expect(200);
      expect(
        (await get(alice, acmeId, `/customers/${customer.id}`).expect(200)).body
          .balance,
      ).toBe(2000);

      const list = (
        await get(alice, acmeId, '/customers?owing=true').expect(200)
      ).body;
      expect(list.map((c: { id: string }) => c.id)).toContain(customer.id);
      expect(
        (await get(alice, acmeId, '/customers?q=77123').expect(200)).body[0].id,
      ).toBe(customer.id);
    });

    it('applies the credit limit of a customer', async () => {
      const customer = await newCustomer({ creditLimit: 2500 });
      const res = await sell({
        customerId: customer.id,
        lines: [{ productId: service.id, quantity: 2 }],
        payments: [{ method: 'credit', amount: 4000 }],
        expectedTotal: 4000,
      }).expect(409);
      expect(res.body.error.code).toBe('CREDIT_LIMIT_EXCEEDED');
    });

    it('keeps customers to their shop', async () => {
      const acmeCustomer = await newCustomer();
      await get(bob, globexId, `/customers/${acmeCustomer.id}`).expect(404);
      await post(bob, globexId, `/customers/${acmeCustomer.id}/payments`, {
        method: 'cash',
        amount: 1,
        clientOperationId: randomUUID(),
      }).expect(404);
      await ctx
        .http()
        .patch(`/api/v1/customers/${acmeCustomer.id}`)
        .set(as(bob, globexId))
        .send({ name: 'Volé' })
        .expect(404);
      expect((await get(bob, globexId, '/customers').expect(200)).body).toEqual(
        [],
      );
      const res = await sell(
        {
          customerId: acmeCustomer.id,
          lines: [{ productId: globexProduct.id, quantity: 1 }],
          payments: [{ method: 'credit', amount: 100 }],
          expectedTotal: 100,
        },
        bob,
        globexId,
      ).expect(400);
      expect(res.body.error.details[0].path).toBe('customerId');
    });
  });

  describe('cancelling a sale', () => {
    it('lets a manager cancel with a reason, puts the goods back and clears the credit', async () => {
      const customer = await newCustomer();
      const before = await stockOf(water.id);
      const sale = (
        await sell({
          customerId: customer.id,
          lines: [{ productId: water.id, quantity: 2 }],
          payments: [{ method: 'credit', amount: 1000 }],
          expectedTotal: 1000,
        }).expect(201)
      ).body;
      expect(await stockOf(water.id)).toBe(before - 2);

      await post(carol, acmeId, `/sales/${sale.id}/cancel`, {
        reason: 'Erreur',
      }).expect(403);
      await post(alice, acmeId, `/sales/${sale.id}/cancel`, {}).expect(400);
      const cancelled = await post(alice, acmeId, `/sales/${sale.id}/cancel`, {
        reason: 'Le client a rendu les bouteilles',
      }).expect(200);
      expect(cancelled.body).toMatchObject({
        status: 'cancelled',
        cancellation: {
          by: { userId: alice.id },
          reason: 'Le client a rendu les bouteilles',
        },
      });
      expect(await stockOf(water.id)).toBe(before);
      expect(
        (await get(alice, acmeId, `/customers/${customer.id}`).expect(200)).body
          .balance,
      ).toBe(0);
      const again = await post(alice, acmeId, `/sales/${sale.id}/cancel`, {
        reason: 'x',
      }).expect(409);
      expect(again.body.error.code).toBe('SALE_ALREADY_CANCELLED');
    });
  });

  describe('lists, summary and visibility', () => {
    it('shows sellers their own sales only, managers and the reader all of them', async () => {
      const mine = (
        await cashSale(
          [{ productId: water.id, quantity: 1 }],
          500,
          carol,
        ).expect(201)
      ).body;
      const all = (await get(alice, acmeId, '/sales').expect(200)).body;
      const carolOnly = (await get(carol, acmeId, '/sales').expect(200)).body;
      expect(all.length).toBeGreaterThan(carolOnly.length);
      expect(
        carolOnly.every(
          (s: { sellerEmail: string }) => s.sellerEmail === carol.email,
        ),
      ).toBe(true);
      expect((await get(dan, acmeId, '/sales').expect(200)).body.length).toBe(
        all.length,
      );
      const aliceSale = all.find(
        (s: { sellerEmail: string }) => s.sellerEmail === alice.email,
      );
      await get(carol, acmeId, `/sales/${aliceSale.id}`).expect(404);
      await get(carol, acmeId, `/sales/${mine.id}`).expect(200);
    });

    it('sums the day by payment method, without cancelled sales', async () => {
      const summary = (await get(alice, acmeId, '/sales/summary').expect(200))
        .body;
      const sales = (await get(alice, acmeId, '/sales').expect(200)).body as {
        status: string;
        total: number;
      }[];
      const completed = sales.filter((s) => s.status === 'completed');
      expect(summary.count).toBe(completed.length);
      expect(summary.total).toBe(
        completed.reduce((sum, s) => sum + s.total, 0),
      );
      expect(summary.cancelledCount).toBe(1);
      const byMethod = Object.values(
        summary.byMethod as Record<string, number>,
      ).reduce((a, b) => a + b, 0);
      expect(byMethod).toBe(summary.total);
      expect(
        (await get(alice, acmeId, '/sales?day=2001-01-01').expect(200)).body,
      ).toEqual([]);
      await get(alice, acmeId, '/sales?day=hier').expect(400);
    });

    it('lists every sale by pages, with no sale twice, in its own shop only', async () => {
      const list = async (user: TestUser, orgId: string, query: string) =>
        (await get(user, orgId, `/sales?${query}`).expect(200)).body as {
          id: string;
          sellerEmail: string;
        }[];
      const everything = await list(alice, acmeId, 'all=true');
      // Whatever the day: an old day has none of them.
      expect(await list(alice, acmeId, 'day=2001-01-01')).toEqual([]);
      expect(everything.length).toBeGreaterThanOrEqual(4);

      const first = await list(alice, acmeId, 'all=true&limit=2&offset=0');
      const second = await list(alice, acmeId, 'all=true&limit=2&offset=2');
      expect(first).toHaveLength(2);
      expect([...first, ...second].map((s) => s.id)).toEqual(
        everything.slice(0, 4).map((s) => s.id),
      );

      // A seller's « all » stays their own; another shop sees none of it.
      for (const sale of await list(carol, acmeId, 'all=true'))
        expect(sale.sellerEmail).toBe(carol.email);
      expect(await list(bob, globexId, 'all=true')).toEqual([]);

      await get(alice, acmeId, '/sales?limit=500').expect(400);
      await get(alice, acmeId, '/sales?offset=-1').expect(400);
    });

    it('pages the customers, products, invoices and quotes of its own shop', async () => {
      for (const path of ['/customers', '/products', '/invoices', '/quotes']) {
        const whole = (await get(alice, acmeId, path).expect(200)).body as {
          id: string;
        }[];
        const page = (await get(alice, acmeId, `${path}?limit=1`).expect(200))
          .body;
        expect(page).toHaveLength(Math.min(1, whole.length));
        const theirs = (
          await get(bob, globexId, `${path}?limit=100`).expect(200)
        ).body as { id: string }[];
        const ours = new Set(whole.map((row) => row.id));
        expect(theirs.filter((row) => ours.has(row.id))).toEqual([]);
      }
    });

    it('never shows a sale of another shop', async () => {
      const sale = (
        await cashSale([{ productId: water.id, quantity: 1 }], 500).expect(201)
      ).body;
      await get(bob, globexId, `/sales/${sale.id}`).expect(404);
      await post(bob, globexId, `/sales/${sale.id}/cancel`, {
        reason: 'x',
      }).expect(404);
      expect((await get(bob, globexId, '/sales').expect(200)).body).toEqual([]);
      expect(
        (await get(bob, globexId, '/sales/summary').expect(200)).body.count,
      ).toBe(0);
    });
  });

  describe('database guarantees', () => {
    it('only lets a sale be cancelled, never edited or deleted, even in SQL', async () => {
      const sale = (
        await cashSale([{ productId: water.id, quantity: 1 }], 500).expect(201)
      ).body;
      await expect(
        ctx.admin.query('update app.sales set total = 1 where id = $1', [
          sale.id,
        ]),
      ).rejects.toThrow(/only be cancelled/);
      await expect(
        ctx.admin.query('delete from app.sales where id = $1', [sale.id]),
      ).rejects.toThrow();
      await expect(
        ctx.admin.query(
          'update app.sale_lines set unit_price = 1 where sale_id = $1',
          [sale.id],
        ),
      ).rejects.toThrow(/append-only/);
      await expect(
        ctx.admin.query(
          `update app.sales set status = 'cancelled' where id = $1`,
          [sale.id],
        ),
      ).rejects.toThrow(); // a cancellation needs who, when and why
    });
  });
});
