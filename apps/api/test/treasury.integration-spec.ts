import { randomUUID } from 'node:crypto';
import type { TestContext, TestUser } from './support/app.js';
import { createTestContext } from './support/app.js';

interface Account {
  id: string;
  kind: string;
  provider: string | null;
  name: string;
  balance: number;
  openingBalance: number;
  used: boolean;
}

describe('Treasury and statistics', () => {
  let ctx: TestContext;
  let alice: TestUser; // owner of Acme and of Acme Thiès, seller at Globex
  let bob: TestUser; // owner of Globex
  let carol: TestUser; // seller (member) of Acme
  let dan: TestUser; // reader (viewer) of Acme
  let acmeId: string;
  let thiesId: string;
  let globexId: string;
  let water: { id: string }; // sold 500, bought 300
  let soap: { id: string }; // sold 750, no purchase price
  let idle: { id: string }; // in stock, never sold
  let customer: { id: string };
  let day: string;

  const as = (user: TestUser, orgId: string) => ({
    Authorization: `Bearer ${user.token}`,
    'X-Organization-Id': orgId,
  });
  const get = (user: TestUser, orgId: string, path: string) =>
    ctx.http().get(`/api/v1${path}`).set(as(user, orgId));
  const post = (
    user: TestUser,
    orgId: string,
    path: string,
    body: object = {},
  ) => ctx.http().post(`/api/v1${path}`).set(as(user, orgId)).send(body);
  const patch = (user: TestUser, orgId: string, path: string, body: object) =>
    ctx.http().patch(`/api/v1${path}`).set(as(user, orgId)).send(body);

  const sell = (
    payments: object[],
    lines: object[],
    total: number,
    extra: object = {},
  ) =>
    post(alice, acmeId, '/sales', {
      lines,
      payments,
      expectedTotal: total,
      clientOperationId: randomUUID(),
      ...extra,
    }).expect(201);
  const treasury = async (orgId = acmeId, user = alice) =>
    (await get(user, orgId, '/treasury').expect(200)).body as {
      accounts: Account[];
      total: number;
      receivables: { customers: number; invoices: number };
      today: { day: string; moneyIn: number; moneyOut: number };
    };
  const account = async (name: string, orgId = acmeId) =>
    (await treasury(orgId)).accounts.find((a) => a.name === name)!;

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
    thiesId = await createOrg(alice, 'Acme Thiès');
    globexId = await createOrg(bob, 'Globex');
    await ctx.admin.query(
      `insert into app.organization_memberships (organization_id, user_id, role)
       values ($1, $2, 'member'), ($1, $3, 'viewer'), ($4, $5, 'member')`,
      [acmeId, carol.id, dan.id, globexId, alice.id],
    );
    const product = async (fields: object) =>
      (
        await post(alice, acmeId, '/products', {
          categoryId: null,
          purchasePrice: null,
          taxRateId: null,
          barcode: null,
          lowStockThreshold: null,
          trackStock: true,
          initialStock: 100,
          clientOperationId: randomUUID(),
          ...fields,
        }).expect(201)
      ).body;
    water = await product({
      name: 'Eau',
      unit: 'bouteille',
      salePrice: 500,
      purchasePrice: 300,
    });
    soap = await product({ name: 'Savon', unit: 'piece', salePrice: 750 });
    idle = await product({ name: 'Parapluie', unit: 'piece', salePrice: 4000 });
    customer = (
      await post(alice, acmeId, '/customers', {
        name: 'Awa Diop',
        clientOperationId: randomUUID(),
      }).expect(201)
    ).body;
    day = (await treasury()).today.day;
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('cash accounts', () => {
    it('gives every new shop its accounts and expense categories', async () => {
      const t = await treasury(thiesId);
      expect(t.accounts.map((a) => a.name)).toEqual([
        'Caisse',
        'Autre Mobile Money',
        'Free Money',
        'Orange Money',
        'Wave',
        'Banque',
      ]);
      expect(t.total).toBe(0);
      expect(t.accounts.filter((a) => a.used).map((a) => a.name)).toEqual([
        'Caisse',
      ]);
      const categories = (
        await get(alice, thiesId, '/expense-categories').expect(200)
      ).body;
      expect(categories).toContainEqual(
        expect.objectContaining({
          name: 'Loyer',
          accountCode: '622',
          status: 'active',
        }),
      );
    });

    it('puts each payment on its account, credit nowhere, and never counts twice', async () => {
      await sell(
        [
          { method: 'cash', amount: 1000 },
          { method: 'mobile_money', provider: 'wave', amount: 500 },
        ],
        [{ productId: water.id, quantity: 3 }],
        1500,
      );
      await sell(
        [{ method: 'card', amount: 750 }],
        [{ productId: soap.id, quantity: 1 }],
        750,
      );
      await sell(
        [{ method: 'credit', amount: 500 }],
        [{ productId: water.id, quantity: 1 }],
        500,
        { customerId: customer.id },
      );
      let t = await treasury();
      const balance = (name: string) =>
        t.accounts.find((a) => a.name === name)!.balance;
      expect([balance('Caisse'), balance('Wave'), balance('Banque')]).toEqual([
        1000, 500, 750,
      ]);
      expect(t.total).toBe(2250);
      expect(t.receivables.customers).toBe(500);

      await post(alice, acmeId, `/customers/${customer.id}/payments`, {
        method: 'cash',
        amount: 200,
        clientOperationId: randomUUID(),
      }).expect(201);

      // An invoice paid by cheque lands at the bank; one copied from a sale
      // paid at the counter adds nothing.
      const invoice = (
        await post(alice, acmeId, '/invoices', {
          customerId: customer.id,
          lines: [
            { label: 'Livraison', unit: 'piece', quantity: 1, unitPrice: 2000 },
          ],
          clientOperationId: randomUUID(),
        }).expect(201)
      ).body;
      await post(alice, acmeId, `/invoices/${invoice.id}/issue`).expect(200);
      t = await treasury();
      expect(t.receivables.invoices).toBe(2000);
      await post(alice, acmeId, `/invoices/${invoice.id}/payments`, {
        method: 'cheque',
        amount: 2000,
        paidOn: day,
        clientOperationId: randomUUID(),
      }).expect(201);
      const sale = (
        await sell(
          [{ method: 'cash', amount: 500 }],
          [{ productId: water.id, quantity: 1 }],
          500,
        )
      ).body;
      const fromSale = (
        await post(alice, acmeId, `/invoices/from-sale/${sale.id}`, {
          customerId: customer.id,
          clientOperationId: randomUUID(),
        }).expect(201)
      ).body;
      await post(alice, acmeId, `/invoices/${fromSale.id}/issue`).expect(200);

      t = await treasury();
      expect([balance('Caisse'), balance('Wave'), balance('Banque')]).toEqual([
        1700, 500, 2750,
      ]);
      expect(t.receivables).toEqual({ customers: 300, invoices: 0 });
      expect(t.today.moneyIn).toBe(4950);
    });

    it('gives the money of a cancelled sale back', async () => {
      const before = (await account('Caisse')).balance;
      const sale = (
        await sell(
          [{ method: 'cash', amount: 1000 }],
          [{ productId: water.id, quantity: 2 }],
          1000,
        )
      ).body;
      expect((await account('Caisse')).balance).toBe(before + 1000);
      await post(alice, acmeId, `/sales/${sale.id}/cancel`, {
        reason: 'Erreur',
      }).expect(200);
      expect((await account('Caisse')).balance).toBe(before);
      const caisse = await account('Caisse');
      const statement = (
        await get(
          alice,
          acmeId,
          `/treasury/movements?accountId=${caisse.id}`,
        ).expect(200)
      ).body;
      const ofSale = statement.movements.filter(
        (m: { sourceId: string }) => m.sourceId === sale.id,
      );
      expect(ofSale).toHaveLength(2);
      expect(ofSale).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ kind: 'sale', amount: 1000 }),
          expect.objectContaining({ kind: 'sale_cancelled', amount: -1000 }),
        ]),
      );
    });

    it('records expenses and transfers, idempotently, and cancels an expense', async () => {
      const caisse = await account('Caisse');
      const banque = await account('Banque');
      const categories = (
        await get(alice, acmeId, '/expense-categories').expect(200)
      ).body;
      const rent = categories.find((c: { name: string }) => c.name === 'Loyer');
      const body = {
        categoryId: rent.id,
        cashAccountId: caisse.id,
        label: 'Loyer d’octobre',
        amount: 300,
        occurredOn: day,
        clientOperationId: randomUUID(),
      };
      const expense = (await post(alice, acmeId, '/expenses', body).expect(201))
        .body;
      expect(expense).toMatchObject({
        label: 'Loyer d’octobre',
        amount: 300,
        status: 'recorded',
        category: { name: 'Loyer', accountCode: '622' },
      });
      await post(alice, acmeId, '/expenses', body).expect(200);
      expect((await account('Caisse')).balance).toBe(caisse.balance - 300);
      await post(alice, acmeId, '/expenses', {
        ...body,
        occurredOn: '2999-01-01',
        clientOperationId: randomUUID(),
      }).expect(400);

      await post(alice, acmeId, `/expenses/${expense.id}/cancel`, {
        reason: '',
      }).expect(400);
      const cancelled = (
        await post(alice, acmeId, `/expenses/${expense.id}/cancel`, {
          reason: 'Payé deux fois',
        }).expect(200)
      ).body;
      expect(cancelled).toMatchObject({
        status: 'cancelled',
        cancellation: { reason: 'Payé deux fois' },
      });
      await post(alice, acmeId, `/expenses/${expense.id}/cancel`, {
        reason: 'Encore',
      }).expect(409);
      expect((await account('Caisse')).balance).toBe(caisse.balance);
      const listed = (
        await get(alice, acmeId, `/expenses?from=${day}&to=${day}`).expect(200)
      ).body;
      expect(listed.map((e: { id: string }) => e.id)).toContain(expense.id);

      const transfer = {
        fromAccountId: caisse.id,
        toAccountId: banque.id,
        amount: 1000,
        occurredOn: day,
        note: 'Dépôt',
        clientOperationId: randomUUID(),
      };
      const t = (
        await post(alice, acmeId, '/treasury/transfers', transfer).expect(201)
      ).body;
      await post(alice, acmeId, '/treasury/transfers', transfer).expect(200);
      const balance = (name: string) =>
        t.accounts.find((a: Account) => a.name === name)!.balance;
      expect(balance('Caisse')).toBe(caisse.balance - 1000);
      expect(balance('Banque')).toBe(banque.balance + 1000);
      await post(alice, acmeId, '/treasury/transfers', {
        ...transfer,
        toAccountId: caisse.id,
        clientOperationId: randomUUID(),
      }).expect(400);
      // Internal moves are not money in or out of the shop: only the sale
      // cancelled above went out today.
      expect((await treasury()).today.moneyOut).toBe(1000);
    });

    it('takes an opening balance, and gives a statement of the period', async () => {
      const wave = await account('Wave');
      const updated = (
        await patch(alice, acmeId, `/treasury/accounts/${wave.id}`, {
          name: 'Wave boutique',
          openingBalance: 10000,
        }).expect(200)
      ).body;
      expect(updated).toMatchObject({
        name: 'Wave boutique',
        openingBalance: 10000,
        balance: wave.balance + 10000,
      });
      const statement = (
        await get(
          alice,
          acmeId,
          `/treasury/movements?accountId=${wave.id}&from=${day}&to=${day}`,
        ).expect(200)
      ).body;
      expect(statement.startBalance).toBe(10000);
      expect(statement.endBalance).toBe(10000 + wave.balance);
      expect(statement.movements).toEqual([
        expect.objectContaining({ kind: 'sale', amount: 500 }),
      ]);
    });
  });

  describe('cash counts', () => {
    it('counts the drawer, keeps the difference, and closes the day for good', async () => {
      const caisse = await account('Caisse');
      const expected = (
        await get(
          alice,
          acmeId,
          `/treasury/closings/expected?cashAccountId=${caisse.id}&day=${day}`,
        ).expect(200)
      ).body;
      expect(expected).toMatchObject({
        expectedAmount: caisse.balance,
        closing: null,
      });
      expect(expected.moneyIn).toBeGreaterThan(0);

      await post(alice, acmeId, '/treasury/closings', {
        cashAccountId: caisse.id,
        day: '2999-01-01',
        countedAmount: 0,
        clientOperationId: randomUUID(),
      }).expect(400);
      const body = {
        cashAccountId: caisse.id,
        day,
        countedAmount: caisse.balance - 100,
        note: 'Il manque 100',
        clientOperationId: randomUUID(),
      };
      const closing = (
        await post(alice, acmeId, '/treasury/closings', body).expect(201)
      ).body;
      expect(closing).toMatchObject({
        expectedAmount: caisse.balance,
        countedAmount: caisse.balance - 100,
        difference: -100,
        day,
      });
      await post(alice, acmeId, '/treasury/closings', body).expect(200);
      await post(alice, acmeId, '/treasury/closings', {
        ...body,
        clientOperationId: randomUUID(),
      }).expect(409);
      // From now on the drawer holds what was counted.
      expect((await account('Caisse')).balance).toBe(caisse.balance - 100);
      const again = (
        await get(
          alice,
          acmeId,
          `/treasury/closings/expected?cashAccountId=${caisse.id}&day=${day}`,
        ).expect(200)
      ).body;
      expect(again.closing.id).toBe(closing.id);

      // The counted day no longer changes.
      const categories = (
        await get(alice, acmeId, '/expense-categories').expect(200)
      ).body;
      await post(alice, acmeId, '/expenses', {
        categoryId: categories[0].id,
        cashAccountId: caisse.id,
        label: 'Oubli',
        amount: 50,
        occurredOn: day,
        clientOperationId: randomUUID(),
      }).expect(409);
      await patch(alice, acmeId, `/treasury/accounts/${caisse.id}`, {
        openingBalance: 5,
      }).expect(409);
      const closings = (
        await get(
          dan,
          acmeId,
          `/treasury/closings?accountId=${caisse.id}`,
        ).expect(200)
      ).body;
      expect(closings).toHaveLength(1);
    });
  });

  describe('statistics', () => {
    it('sums the completed sales of the period, with the margin it can compute', async () => {
      const stats = (
        await get(alice, acmeId, `/stats/summary?from=${day}&to=${day}`).expect(
          200,
        )
      ).body;
      // Kept: 1 500 + 750 + 500 (credit) + 500; the cancelled 1 000 is not.
      expect(stats).toMatchObject({
        from: day,
        to: day,
        salesCount: 4,
        revenue: 3250,
        averageBasket: 813,
      });
      expect(stats.byMethod).toEqual({
        cash: 1500,
        mobile_money: 500,
        card: 750,
        credit: 500,
      });
      // Water: 5 bottles sold 2 500, bought 1 500; soap has no purchase price.
      expect(stats.margin).toEqual({
        amount: 1000,
        costedRevenue: 2500,
        coverageBasisPoints: 7692,
      });
      expect(stats.days).toEqual([{ day, revenue: 3250, count: 4 }]);
      expect(stats.topProducts[0]).toMatchObject({
        productId: water.id,
        quantity: 5,
        revenue: 2500,
      });
      expect(stats.slowProducts.map((p: { id: string }) => p.id)).toEqual([
        idle.id,
      ]);
      expect(stats.expenses).toBe(0); // the only expense was cancelled

      const week = (
        await get(
          alice,
          acmeId,
          `/stats/summary?to=${day}&from=2026-01-01`,
        ).expect(200)
      ).body;
      expect(week.days.at(-1)).toEqual({ day, revenue: 3250, count: 4 });
      await get(
        alice,
        acmeId,
        '/stats/summary?from=2020-01-01&to=2026-01-01',
      ).expect(400);
      await get(
        alice,
        acmeId,
        `/stats/summary?from=${day}&to=2020-01-01`,
      ).expect(400);
    });

    it('compares the shops where the person may read statistics', async () => {
      const shops = (
        await ctx
          .http()
          .get('/api/v1/stats/shops')
          .set({ Authorization: `Bearer ${alice.token}` })
          .expect(200)
      ).body;
      // Globex, where Alice only sells, is not listed.
      expect(shops.map((s: { name: string }) => s.name)).toEqual([
        'Acme Dakar',
        'Acme Thiès',
      ]);
      expect(shops[0]).toMatchObject({
        role: 'owner',
        today: { revenue: 3250, count: 4 },
        currency: 'XOF',
      });
      expect(shops[1].today).toEqual({ revenue: 0, count: 0 });
      const forCarol = (
        await ctx
          .http()
          .get('/api/v1/stats/shops')
          .set({ Authorization: `Bearer ${carol.token}` })
          .expect(200)
      ).body;
      expect(forCarol).toEqual([]);
    });
  });

  describe('roles', () => {
    it('lets the reader read and keeps money matters away from sellers', async () => {
      await get(dan, acmeId, '/treasury').expect(200);
      await get(dan, acmeId, '/stats/summary').expect(200);
      const caisse = await account('Caisse');
      await patch(dan, acmeId, `/treasury/accounts/${caisse.id}`, {
        name: 'X',
      }).expect(403);
      await post(dan, acmeId, '/expense-categories', {
        name: 'Divers',
        accountCode: '658',
      }).expect(403);
      await get(carol, acmeId, '/treasury').expect(403);
      await get(carol, acmeId, '/stats/summary').expect(403);
      await get(carol, acmeId, '/expenses').expect(403);
    });

    it('manages expense categories with unique names', async () => {
      const created = (
        await post(alice, acmeId, '/expense-categories', {
          name: 'Publicité',
          accountCode: '627',
        }).expect(201)
      ).body;
      await post(alice, acmeId, '/expense-categories', {
        name: 'publicité',
        accountCode: '627',
      }).expect(409);
      await post(alice, acmeId, '/expense-categories', {
        name: 'Divers',
        accountCode: 'abc',
      }).expect(400);
      const archived = (
        await patch(alice, acmeId, `/expense-categories/${created.id}`, {
          status: 'archived',
        }).expect(200)
      ).body;
      expect(archived.status).toBe('archived');
      await post(alice, acmeId, '/expenses', {
        categoryId: created.id,
        cashAccountId: (await account('Banque')).id,
        label: 'Affiches',
        amount: 100,
        occurredOn: day,
        clientOperationId: randomUUID(),
      }).expect(400); // archived category
    });
  });

  describe('isolation between shops', () => {
    it('never shows nor touches the money of another shop', async () => {
      const caisse = await account('Caisse');
      const categories = (
        await get(alice, acmeId, '/expense-categories').expect(200)
      ).body;
      const expenses = (
        await get(alice, acmeId, `/expenses?from=${day}&to=${day}`).expect(200)
      ).body;
      const globexCaisse = await account('Caisse', globexId).catch(() => null);
      const bobTreasury = await treasury(globexId, bob);
      expect(bobTreasury.total).toBe(0);
      expect(bobTreasury.accounts.map((a) => a.id)).not.toContain(caisse.id);
      expect(globexCaisse).toBeNull(); // Alice only sells at Globex: no access

      await get(
        bob,
        globexId,
        `/treasury/movements?accountId=${caisse.id}`,
      ).expect(404);
      await patch(bob, globexId, `/treasury/accounts/${caisse.id}`, {
        name: 'Volée',
      }).expect(404);
      await get(
        bob,
        globexId,
        `/treasury/closings?accountId=${caisse.id}`,
      ).expect(404);
      await get(
        bob,
        globexId,
        `/treasury/closings/expected?cashAccountId=${caisse.id}&day=${day}`,
      ).expect(404);
      await post(bob, globexId, '/treasury/closings', {
        cashAccountId: caisse.id,
        day,
        countedAmount: 0,
        clientOperationId: randomUUID(),
      }).expect(404);
      const bobCaisse = bobTreasury.accounts.find((a) => a.name === 'Caisse')!;
      await post(bob, globexId, '/treasury/transfers', {
        fromAccountId: bobCaisse.id,
        toAccountId: caisse.id,
        amount: 100,
        occurredOn: day,
        clientOperationId: randomUUID(),
      }).expect(404);
      await post(bob, globexId, '/expenses', {
        categoryId: categories[0].id,
        cashAccountId: bobCaisse.id,
        label: 'x',
        amount: 1,
        occurredOn: day,
        clientOperationId: randomUUID(),
      }).expect(400); // Acme's category
      await post(bob, globexId, `/expenses/${expenses[0].id}/cancel`, {
        reason: 'x',
      }).expect(404);
      await patch(bob, globexId, `/expense-categories/${categories[0].id}`, {
        name: 'x',
      }).expect(404);
      const globexStats = (
        await get(bob, globexId, '/stats/summary').expect(200)
      ).body;
      expect(globexStats.salesCount).toBe(0);
      expect(globexStats.slowProducts).toEqual([]);
      expect((await get(bob, globexId, '/expenses').expect(200)).body).toEqual(
        [],
      );
    });
  });

  describe('database guarantees', () => {
    it('keeps expenses, transfers and counts as recorded, even in SQL', async () => {
      const { rows } = await ctx.admin.query(
        `select id from app.expenses where organization_id = $1 limit 1`,
        [acmeId],
      );
      await expect(
        ctx.admin.query('update app.expenses set amount = 1 where id = $1', [
          rows[0].id,
        ]),
      ).rejects.toThrow(/only be cancelled/);
      await expect(
        ctx.admin.query('delete from app.expenses where id = $1', [rows[0].id]),
      ).rejects.toThrow();
      await expect(
        ctx.admin.query(
          'update app.cash_transfers set amount = 1 where organization_id = $1',
          [acmeId],
        ),
      ).rejects.toThrow(/append-only/);
      await expect(
        ctx.admin.query(
          'update app.cash_closings set counted_amount = 1 where organization_id = $1',
          [acmeId],
        ),
      ).rejects.toThrow(/append-only/);
      await expect(
        ctx.admin.query(
          'delete from app.cash_closings where organization_id = $1',
          [acmeId],
        ),
      ).rejects.toThrow(/append-only/);
    });
  });
});
