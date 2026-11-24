import { randomUUID } from 'node:crypto';
import type { TestContext, TestUser } from './support/app.js';
import { createTestContext } from './support/app.js';

/** Customer orders, phase 1 (ADR-072). */
describe('Customer orders', () => {
  let ctx: TestContext;
  let alice: TestUser; // owner of Acme
  let bob: TestUser; // owner of Globex
  let carol: TestUser; // seller of Acme
  let dan: TestUser; // reader of Acme
  let acmeId: string;
  let globexId: string;
  let cake: { id: string }; // 5 000 F, stock 10
  let fatou: { id: string };
  let day: string;

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

  const order = (body: Record<string, unknown> = {}, user = alice) =>
    post(user, acmeId, '/orders', {
      clientOperationId: randomUUID(),
      customerId: fatou.id,
      lines: [{ productId: cake.id, quantity: 1, note: 'Joyeux anniversaire' }],
      dueOn: day,
      fulfilment: 'pickup',
      ...body,
    });
  const cash = async (orgId = acmeId) =>
    (
      (await get(alice, orgId, '/treasury').expect(200)).body as {
        accounts: { name: string; balance: number }[];
      }
    ).accounts.find((a) => a.name === 'Caisse')!.balance;
  const stockOf = async (productId: string) =>
    (await get(alice, acmeId, `/products/${productId}`).expect(200)).body
      .stockQuantity as number;

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
          .send({ name, timezone: 'Africa/Dakar' })
          .expect(201)
      ).body.id as string;
    acmeId = await createOrg(alice, 'Acme Dakar');
    globexId = await createOrg(bob, 'Globex');
    await ctx.admin.query(
      `insert into app.organization_memberships (organization_id, user_id, role)
       values ($1, $2, 'member'), ($1, $3, 'viewer')`,
      [acmeId, carol.id, dan.id],
    );
    cake = (
      await post(alice, acmeId, '/products', {
        name: 'Gâteau',
        categoryId: null,
        unit: 'piece',
        salePrice: 5000,
        purchasePrice: null,
        taxRateId: null,
        barcode: null,
        trackStock: true,
        lowStockThreshold: null,
        initialStock: 10,
        clientOperationId: randomUUID(),
      }).expect(201)
    ).body;
    fatou = (
      await post(alice, acmeId, '/customers', {
        name: 'Fatou',
        phone: '77 111 22 33',
        clientOperationId: randomUUID(),
      }).expect(201)
    ).body;
    day = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Dakar',
    }).format(new Date());
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('stays off until the owner turns it on, checked by the server', async () => {
    const shop = (
      await get(alice, acmeId, '/organizations/current').expect(200)
    ).body;
    expect(shop.ordersEnabled).toBe(false);
    const res = await order().expect(403);
    expect(res.body.error.code).toBe('ORDERS_DISABLED');
    // Only the owner and the managers change it.
    await patch(carol, acmeId, '/organizations/current', {
      ordersEnabled: true,
    }).expect(403);
    await patch(alice, acmeId, '/organizations/current', {
      ordersEnabled: true,
    }).expect(200);
  });

  it('takes an order with a deposit, numbered by the server, once', async () => {
    const before = await cash();
    const body = {
      clientOperationId: randomUUID(),
      customerId: fatou.id,
      lines: [
        { productId: cake.id, quantity: 2, note: 'Chocolat' },
        { label: 'Bougies dorées', quantity: 1, agreedTotal: 1500 },
      ],
      dueOn: day,
      dueTime: '16:00',
      fulfilment: 'delivery',
      deliveryAddress: 'Sacré-Cœur 3, villa 12',
      deliveryLandmark: 'Après la pharmacie',
      deliveryFee: 1000,
      deposit: { method: 'cash', amount: 5000 },
    };
    const first = await post(carol, acmeId, '/orders', body).expect(201);
    const again = await post(carol, acmeId, '/orders', body).expect(200);
    expect(again.body.id).toBe(first.body.id);
    expect(first.body).toMatchObject({
      number: `C-${day.slice(0, 4)}-0001`,
      status: 'received',
      itemsTotal: 11500,
      deliveryFee: 1000,
      total: 12500,
      paid: 5000,
      remaining: 7500,
      dueTime: '16:00',
      late: false,
    });
    expect(first.body.lines[0]).toMatchObject({
      label: 'Gâteau',
      unitPrice: 5000,
      lineTotal: 10000,
      note: 'Chocolat',
    });
    // The deposit is in the money the day it is received; no sale yet.
    expect(await cash()).toBe(before + 5000);
    expect(await stockOf(cake.id)).toBe(10);
    expect(
      (await get(alice, acmeId, '/stats/summary').expect(200)).body.salesCount,
    ).toBe(0);
  });

  it('checks what an order asks for', async () => {
    await order({ lines: [] }).expect(400);
    await order({ lines: [{ label: 'Robe', quantity: 1 }] }).expect(400);
    await order({ fulfilment: 'delivery' }).expect(400); // no address
    await order({ deliveryFee: 500 }).expect(400); // a pickup has no fee
    const tooMuch = await order({
      deposit: { method: 'cash', amount: 6000 },
    }).expect(400);
    expect(JSON.stringify(tooMuch.body)).toContain('ne peut pas dépasser');
    await order({
      deposit: { method: 'mobile_money', amount: 100 },
    }).expect(400); // no operator
    const other = (
      await post(bob, globexId, '/customers', {
        name: 'Client Globex',
        clientOperationId: randomUUID(),
      }).expect(201)
    ).body;
    await order({ customerId: other.id }).expect(400);
    await order({}, dan).expect(403);
  });

  it('moves through its steps, then hands over as a sale with the deposit counted once', async () => {
    const open = (await get(alice, acmeId, '/orders').expect(200)).body as {
      id: string;
      number: string;
    }[];
    const delivery = open[0]!;
    await post(carol, acmeId, `/orders/${delivery.id}/status`, {
      status: 'in_preparation',
    }).expect(200);
    await post(carol, acmeId, `/orders/${delivery.id}/status`, {
      status: 'out_for_delivery',
    }).expect(200);
    // A second deposit, never above what is left.
    await post(carol, acmeId, `/orders/${delivery.id}/payments`, {
      clientOperationId: randomUUID(),
      method: 'cash',
      amount: 9000,
    }).expect(400);
    const deposit = {
      clientOperationId: randomUUID(),
      method: 'mobile_money',
      provider: 'wave',
      reference: 'W-1',
      amount: 2500,
    };
    await post(
      carol,
      acmeId,
      `/orders/${delivery.id}/payments`,
      deposit,
    ).expect(201);
    const replay = await post(
      carol,
      acmeId,
      `/orders/${delivery.id}/payments`,
      deposit,
    ).expect(200);
    expect(replay.body).toMatchObject({ paid: 7500, remaining: 5000 });

    const before = await cash();
    // What is left does not cover the total: refused.
    await post(carol, acmeId, `/orders/${delivery.id}/deliver`, {
      payments: [{ method: 'cash', amount: 1000 }],
    }).expect(400);
    const handed = (
      await post(carol, acmeId, `/orders/${delivery.id}/deliver`, {
        payments: [{ method: 'cash', amount: 5000 }],
        cashReceived: 10000,
      }).expect(200)
    ).body;
    expect(handed.status).toBe('delivered');
    // Sent twice: the same order, one sale.
    const twice = (
      await post(carol, acmeId, `/orders/${delivery.id}/deliver`, {
        payments: [{ method: 'cash', amount: 5000 }],
      }).expect(200)
    ).body;
    expect(twice.saleId).toBe(handed.saleId);

    const sale = (
      await get(alice, acmeId, `/sales/${handed.saleId}`).expect(200)
    ).body;
    expect(sale).toMatchObject({
      total: 12500,
      orderNumber: delivery.number,
      customer: { id: fatou.id },
      changeGiven: 5000,
    });
    expect(
      sale.lines.map((l: { label: string; lineTotal: number }) => [
        l.label,
        l.lineTotal,
      ]),
    ).toEqual([
      ['Gâteau', 10000],
      ['Bougies dorées', 1500],
      ['Frais de livraison', 1000],
    ]);
    expect(
      sale.payments.filter((p: { fromOrder?: boolean }) => p.fromOrder),
    ).toHaveLength(2);
    // Only what is left enters the money now; the stock leaves now.
    expect(await cash()).toBe(before + 5000);
    expect(await stockOf(cake.id)).toBe(8);
    const stats = (await get(alice, acmeId, '/stats/summary').expect(200)).body;
    expect(stats.revenue).toBe(12500);
    // The deposits are receipts of their day in the journal, split like
    // the order; the sale adds only what was paid at the handover.
    const journal = (
      await get(
        alice,
        acmeId,
        `/accounting/journal?from=${day}&to=${day}`,
      ).expect(200)
    ).body;
    expect(journal.totals.receipts).toBe(12500);
    // The fee is not a product of the catalogue.
    const listed = (await get(alice, acmeId, '/products').expect(200)).body as {
      name: string;
    }[];
    expect(listed.map((p) => p.name)).toEqual(['Gâteau']);
    await post(carol, acmeId, `/orders/${delivery.id}/status`, {
      status: 'ready',
    }).expect(409);
  });

  it('gives the deposit back when the owner cancels', async () => {
    const taken = (
      await order({ deposit: { method: 'cash', amount: 2000 } }).expect(201)
    ).body;
    await post(alice, acmeId, `/orders/${taken.id}/status`, {
      status: 'out_for_delivery',
    }).expect(400); // a pickup
    // The seller takes orders but does not cancel them.
    await post(carol, acmeId, `/orders/${taken.id}/cancel`, {
      reason: 'Client parti',
    }).expect(403);
    await post(alice, acmeId, `/orders/${taken.id}/cancel`, {
      reason: 'Client parti',
    }).expect(400); // how is the deposit given back?
    const before = await cash();
    const cancelled = (
      await post(alice, acmeId, `/orders/${taken.id}/cancel`, {
        reason: 'Client parti',
        refund: { method: 'cash' },
      }).expect(200)
    ).body;
    expect(cancelled).toMatchObject({
      status: 'cancelled',
      paid: 0,
      cancellation: { reason: 'Client parti' },
    });
    expect(await cash()).toBe(before - 2000);
    await post(alice, acmeId, `/orders/${taken.id}/deliver`, {
      payments: [],
    }).expect(409);
    const closed = (
      await get(alice, acmeId, '/orders?state=closed').expect(200)
    ).body as { id: string }[];
    expect(closed.map((o) => o.id)).toContain(taken.id);
  });

  it('counts the orders due today or late for the home page', async () => {
    await order({ dueOn: '2020-01-01' }).expect(201);
    const summary = (await get(dan, acmeId, '/orders/summary').expect(200))
      .body;
    expect(summary).toEqual({ dueNow: 1, late: 1, waitingReady: 0 });
    const late = (await get(dan, acmeId, '/orders').expect(200)).body as {
      late: boolean;
    }[];
    expect(late[0]!.late).toBe(true);
  });

  it('keeps orders to their shop, and to the database rules', async () => {
    const mine = (await get(alice, acmeId, '/orders').expect(200)).body as {
      id: string;
    }[];
    const id = mine[0]!.id;
    await get(bob, globexId, `/orders/${id}`).expect(404);
    expect((await get(bob, globexId, '/orders').expect(200)).body).toEqual([]);
    await post(bob, globexId, `/orders/${id}/payments`, {
      clientOperationId: randomUUID(),
      method: 'cash',
      amount: 100,
    }).expect(404);
    await post(bob, globexId, `/orders/${id}/status`, {
      status: 'ready',
    }).expect(404);
    await post(bob, globexId, `/orders/${id}/deliver`, { payments: [] }).expect(
      404,
    );
    await post(bob, globexId, `/orders/${id}/cancel`, {
      reason: 'x',
    }).expect(404);
    await get(alice, acmeId, '/orders/not-a-uuid').expect(404);
    await expect(
      ctx.admin.query('update app.order_payments set amount = 1'),
    ).rejects.toThrow(/append-only/);
  });
});
