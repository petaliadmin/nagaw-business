import { randomUUID } from 'node:crypto';
import type { TestContext, TestUser } from './support/app.js';
import { createTestContext } from './support/app.js';

/** Ma vitrine (ADR-075). */
describe('Ma vitrine', () => {
  let ctx: TestContext;
  let alice: TestUser; // owner of Acme
  let bob: TestUser; // owner of Globex
  let carol: TestUser; // seller of Acme
  let dan: TestUser; // reader of Acme
  let acmeId: string;
  let globexId: string;
  let bazin: { id: string }; // 6 500 F, stock 10, alert at 3
  let couture: { id: string }; // service, price on request
  let hidden: { id: string }; // never on the storefront
  let globexSoap: { id: string };
  let slug: string;
  let day: string;
  let ip = 0;

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
  const put = (user: TestUser, orgId: string, path: string, body: object) =>
    ctx.http().put(`/api/v1${path}`).set(as(user, orgId)).send(body);
  const pub = (path: string) => ctx.http().get(`/api/v1/public${path}`);
  /** Each send from its own address, unless the test says otherwise. */
  const send = (
    address: string,
    body: Record<string, unknown> = {},
    from = `10.0.0.${(ip += 1)}`,
  ) =>
    ctx
      .http()
      .post(`/api/v1/public/storefronts/${address}/orders`)
      .set('X-Forwarded-For', from)
      .send({
        clientOperationId: randomUUID(),
        lines: [{ article: 'bazin-riche', quantity: 3 }],
        dueOn: day,
        name: 'Mariama Diop',
        phone: `77 ${String(100 + ip).padStart(3, '0')} 45 67`,
        ...body,
      });

  const product = (
    user: TestUser,
    orgId: string,
    body: Record<string, unknown>,
  ) =>
    post(user, orgId, '/products', {
      categoryId: null,
      unit: 'piece',
      purchasePrice: 4000,
      taxRateId: null,
      barcode: null,
      trackStock: true,
      lowStockThreshold: null,
      clientOperationId: randomUUID(),
      ...body,
    }).expect(201);

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
    acmeId = await createOrg(alice, 'Chez Aïssatou');
    globexId = await createOrg(bob, 'Globex');
    await ctx.admin.query(
      `insert into app.organization_memberships (organization_id, user_id, role)
       values ($1, $2, 'member'), ($1, $3, 'viewer')`,
      [acmeId, carol.id, dan.id],
    );
    bazin = (
      await product(alice, acmeId, {
        name: 'Bazin riche',
        salePrice: 6500,
        lowStockThreshold: 3,
        initialStock: 10,
      })
    ).body;
    couture = (
      await product(alice, acmeId, {
        name: 'Couture boubou',
        kind: 'service',
        unit: 'prestation',
        salePrice: 10000,
        purchasePrice: null,
        trackStock: false,
      })
    ).body;
    hidden = (
      await product(alice, acmeId, {
        name: 'Tissu caché',
        salePrice: 1000,
        initialStock: 5,
      })
    ).body;
    globexSoap = (
      await product(bob, globexId, {
        name: 'Savon',
        salePrice: 500,
        initialStock: 5,
      })
    ).body;
    day = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Dakar',
    }).format(new Date());
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('stays off until the owner turns it on; a seller cannot', async () => {
    const settings = (await get(alice, acmeId, '/storefront').expect(200)).body;
    expect(settings).toMatchObject({
      enabled: false,
      slug: null,
      suggestedSlug: 'chez-aissatou',
    });
    await patch(carol, acmeId, '/storefront', { enabled: true }).expect(403);
    await patch(dan, acmeId, '/storefront', { enabled: true }).expect(403);
    const on = (
      await patch(alice, acmeId, '/storefront', {
        enabled: true,
        tagline: 'Tissus et couture',
        landmark: 'Marché HLM, allée 4',
      }).expect(200)
    ).body;
    slug = on.slug;
    expect(slug).toBe('chez-aissatou');
    // Orders come with the storefront.
    const shop = (
      await get(alice, acmeId, '/organizations/current').expect(200)
    ).body;
    expect(shop.ordersEnabled).toBe(true);
  });

  it('shows only the articles chosen, in words, without what is private', async () => {
    // Nothing chosen yet.
    expect(
      (await pub(`/storefronts/${slug}`).expect(200)).body.articles,
    ).toEqual([]);
    await put(carol, acmeId, '/storefront/articles', {
      articles: [{ productId: bazin.id, visible: true }],
    }).expect(403);
    // Another shop's product is refused.
    await put(alice, acmeId, '/storefront/articles', {
      articles: [{ productId: globexSoap.id, visible: true }],
    }).expect(400);
    await put(alice, acmeId, '/storefront/articles', {
      articles: [
        { productId: bazin.id, visible: true },
        {
          productId: couture.id,
          visible: true,
          priceMode: 'on_request',
          description: 'Sur mesure, en trois jours',
        },
      ],
    }).expect(200);
    const res = await pub(`/storefronts/${slug}`).expect(200);
    expect(res.body).toMatchObject({
      slug,
      movedTo: null,
      name: 'Chez Aïssatou',
      tagline: 'Tissus et couture',
      currency: 'XOF',
    });
    expect(res.body.articles).toEqual([
      {
        handle: 'bazin-riche',
        name: 'Bazin riche',
        kind: 'product',
        category: null,
        unit: 'piece',
        price: 6500,
        description: '',
        availability: 'available',
        photoVersion: null,
      },
      {
        handle: 'couture-boubou',
        name: 'Couture boubou',
        kind: 'service',
        category: null,
        unit: 'prestation',
        price: null,
        description: 'Sur mesure, en trois jours',
        availability: 'available',
        photoVersion: null,
      },
    ]);
    const raw = JSON.stringify(res.body);
    for (const secret of [
      acmeId,
      bazin.id,
      'purchase',
      '4000',
      'stockQuantity',
      'Tissu caché',
    ])
      expect(raw).not.toContain(secret);
  });

  it('answers the same 404 for an unknown, hidden or switched-off storefront', async () => {
    const unknown = await pub('/storefronts/personne-ici').expect(404);
    expect(unknown.body.error.code).toBe('STOREFRONT_NOT_FOUND');
    await pub('/storefronts/admin').expect(404);
    // Globex has no storefront.
    await patch(bob, globexId, '/storefront', { enabled: true }).expect(200);
    await patch(bob, globexId, '/storefront', { enabled: false }).expect(200);
    await pub('/storefronts/globex').expect(404);
    await pub(`/storefronts/${slug}/articles/tissu-cache/photo`).expect(404);
  });

  it('records an order to confirm, once, with prices from the server', async () => {
    const body = {
      clientOperationId: randomUUID(),
      lines: [
        { article: 'bazin-riche', quantity: 3, note: 'Bleu roi' },
        { article: 'couture-boubou', quantity: 1 },
      ],
      dueOn: day,
      dueTime: '17:00',
      name: 'Mariama Diop',
      phone: '77 123 45 67',
      note: 'Je passe après le travail',
    };
    const first = await send(slug, body, '10.1.0.1').expect(201);
    const again = await send(slug, body, '10.1.0.1').expect(200);
    expect(again.body).toEqual(first.body);
    expect(first.body).toMatchObject({
      number: `C-${day.slice(0, 4)}-0001`,
      status: 'to_confirm',
    });
    expect(first.body.trackingToken).toMatch(/^[0-9a-f]{40}$/);

    const orders = (await get(carol, acmeId, '/orders').expect(200)).body;
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({
      status: 'to_confirm',
      source: 'storefront',
      customer: null,
      requester: { name: 'Mariama Diop', phone: '221771234567' },
      itemsTotal: 19500,
      fulfilment: 'pickup',
      deliveryFee: 0,
      dueTime: '17:00',
    });
    expect(orders[0].lines[1]).toMatchObject({
      label: 'Couture boubou',
      priceToSet: true,
      lineTotal: 0,
    });
    const summary = (await get(alice, acmeId, '/orders/summary').expect(200))
      .body;
    expect(summary.toConfirm).toBe(1);
    // The shop is told.
    const { rows } = await ctx.admin.query(
      `select title from app.notifications
        where organization_id = $1 and category = 'orders'`,
      [acmeId],
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].title).toBe('Nouvelle commande de Mariama');

    const tracking = await pub(
      `/storefronts/${slug}/tracking/${first.body.trackingToken}`,
    ).expect(200);
    expect(tracking.body).toMatchObject({
      number: first.body.number,
      status: 'to_confirm',
      firstName: 'Mariama',
      itemsTotal: 19500,
      pricesToCome: true,
    });
    expect(JSON.stringify(tracking.body)).not.toContain('77 123');
    // Another shop's address never shows it.
    await patch(bob, globexId, '/storefront', { enabled: true }).expect(200);
    await pub(
      `/storefronts/globex/tracking/${first.body.trackingToken}`,
    ).expect(404);
    await pub(`/storefronts/${slug}/tracking/${'0'.repeat(40)}`).expect(404);
  });

  it('refuses what the storefront does not offer', async () => {
    for (const lines of [
      [{ article: 'tissu-cache', quantity: 1 }],
      [{ article: 'savon', quantity: 1 }],
      [{ article: 'bazin-riche', quantity: 1.5 }],
    ]) {
      const res = await send(slug, { lines }).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    }
    // Delivery, deposit or price are not fields of the storefront.
    for (const extra of [
      { fulfilment: 'delivery' },
      { deposit: { method: 'cash', amount: 1000 } },
      { customerId: randomUUID() },
    ])
      await send(slug, extra).expect(400);
    // A day in the past, or too far.
    await send(slug, { dueOn: '2020-01-01' }).expect(400);
    await send(slug, { dueOn: '2099-01-01' }).expect(400);
  });

  it('keeps nothing from a robot that fills the hidden field', async () => {
    const before = (await get(alice, acmeId, '/orders').expect(200)).body
      .length;
    const res = await send(slug, { website: 'http://spam.example' }).expect(
      201,
    );
    expect(res.body.status).toBe('to_confirm');
    expect((await get(alice, acmeId, '/orders').expect(200)).body).toHaveLength(
      before,
    );
  });

  it('limits sends by address and pending orders by phone, from the settings', async () => {
    await ctx.admin.query(
      `update app.platform_settings
          set storefront_max_orders_per_ip_hour = 2,
              storefront_max_pending_per_phone = 1`,
    );
    try {
      const from = '10.9.9.9';
      await send(slug, { phone: '70 000 00 01' }, from).expect(201);
      await send(slug, { phone: '70 000 00 02' }, from).expect(201);
      const third = await send(slug, { phone: '70 000 00 03' }, from).expect(
        429,
      );
      expect(third.body.error.code).toBe('TOO_MANY_ORDERS');
      // One phone, one order waiting at a time.
      await send(slug, { phone: '70 000 00 04' }).expect(201);
      const pending = await send(slug, { phone: '70 000 00 04' }).expect(429);
      expect(pending.body.error.code).toBe('TOO_MANY_PENDING_ORDERS');
    } finally {
      await ctx.admin.query(
        `update app.platform_settings
            set storefront_max_orders_per_ip_hour = 10,
                storefront_max_pending_per_phone = 3`,
      );
    }
  });

  it('accepts: the person becomes a customer, the price on request is set', async () => {
    const sent = await send(slug, {
      lines: [
        { article: 'bazin-riche', quantity: 2 },
        { article: 'couture-boubou', quantity: 1 },
      ],
      name: 'Awa Ndiaye',
      phone: '76 555 44 33',
    }).expect(201);
    const order = (await get(alice, acmeId, '/orders').expect(200)).body.find(
      (o: { number: string }) => o.number === sent.body.number,
    );
    // Not before a decision: no deposit, no handover, no step.
    await post(carol, acmeId, `/orders/${order.id}/payments`, {
      clientOperationId: randomUUID(),
      method: 'cash',
      amount: 1000,
    }).expect(409);
    await post(carol, acmeId, `/orders/${order.id}/status`, {
      status: 'ready',
    }).expect(409);
    await post(carol, acmeId, `/orders/${order.id}/deliver`, {}).expect(409);
    // A reader decides nothing; another shop does not see it.
    await post(dan, acmeId, `/orders/${order.id}/accept`, {}).expect(403);
    await post(bob, globexId, `/orders/${order.id}/accept`, {}).expect(404);
    await get(bob, globexId, `/orders/${order.id}`).expect(404);
    // The price on request is required.
    await post(carol, acmeId, `/orders/${order.id}/accept`, {}).expect(400);

    const accepted = await post(carol, acmeId, `/orders/${order.id}/accept`, {
      prices: [{ line: 1, lineTotal: 12000 }],
    }).expect(200);
    expect(accepted.body).toMatchObject({
      status: 'received',
      customer: { name: 'Awa Ndiaye', phone: '221765554433' },
      itemsTotal: 25000,
      total: 25000,
    });
    expect(accepted.body.lines[1]).toMatchObject({
      lineTotal: 12000,
      priceToSet: false,
    });
    // Sent twice: the same order, one customer.
    await post(carol, acmeId, `/orders/${order.id}/accept`, {
      prices: [{ line: 1, lineTotal: 12000 }],
    }).expect(200);
    const { rows } = await ctx.admin.query(
      `select count(*)::int as n from app.customers
        where organization_id = $1 and name = 'Awa Ndiaye'`,
      [acmeId],
    );
    expect(rows[0].n).toBe(1);

    // Then the ordinary path of ADR-072: handed over, paid at pickup.
    const delivered = await post(alice, acmeId, `/orders/${order.id}/deliver`, {
      payments: [{ method: 'cash', amount: 25000 }],
      cashReceived: 25000,
    }).expect(200);
    expect(delivered.body.status).toBe('delivered');
    const tracking = await pub(
      `/storefronts/${slug}/tracking/${sent.body.trackingToken}`,
    ).expect(200);
    expect(tracking.body).toMatchObject({
      status: 'delivered',
      itemsTotal: 25000,
      pricesToCome: false,
    });
  });

  it('proposes another day, then refuses with a reason', async () => {
    const sent = await send(slug, { name: 'Oumar Sow' }).expect(201);
    const order = (await get(alice, acmeId, '/orders').expect(200)).body.find(
      (o: { number: string }) => o.number === sent.body.number,
    );
    const later = new Date(`${day}T12:00:00Z`);
    later.setUTCDate(later.getUTCDate() + 2);
    const moved = await post(carol, acmeId, `/orders/${order.id}/reschedule`, {
      dueOn: later.toISOString().slice(0, 10),
      dueTime: '10:00',
    }).expect(200);
    expect(moved.body.dueOn).toBe(later.toISOString().slice(0, 10));
    // A seller does not refuse.
    await post(carol, acmeId, `/orders/${order.id}/decline`, {
      reason: 'sold_out',
    }).expect(403);
    await post(alice, acmeId, `/orders/${order.id}/decline`, {
      reason: 'other',
    }).expect(400);
    const declined = await post(alice, acmeId, `/orders/${order.id}/decline`, {
      reason: 'closed',
      detail: 'Fermé pour la Tabaski',
    }).expect(200);
    expect(declined.body).toMatchObject({
      status: 'cancelled',
      cancellation: { reason: 'Fermé ce jour-là : Fermé pour la Tabaski' },
    });
    await post(alice, acmeId, `/orders/${order.id}/decline`, {
      reason: 'closed',
    }).expect(200);
    await post(alice, acmeId, `/orders/${order.id}/accept`, {}).expect(409);
    const tracking = await pub(
      `/storefronts/${slug}/tracking/${sent.body.trackingToken}`,
    ).expect(200);
    expect(tracking.body).toMatchObject({
      status: 'cancelled',
      declineReason: 'Fermé ce jour-là : Fermé pour la Tabaski',
    });
  });

  it('keeps an old address leading to the new one, and refuses a taken one', async () => {
    await patch(alice, acmeId, '/storefront', {
      slug: 'chez-aissatou-dakar',
    }).expect(200);
    const old = await pub('/storefronts/chez-aissatou').expect(200);
    expect(old.body.movedTo).toBe('chez-aissatou-dakar');
    const taken = await patch(bob, globexId, '/storefront', {
      slug: 'chez-aissatou',
    }).expect(409);
    expect(taken.body.error.code).toBe('STOREFRONT_SLUG_TAKEN');
    await patch(alice, acmeId, '/storefront', { slug: 'API' }).expect(400);
    slug = 'chez-aissatou-dakar';
  });

  it('counts visits and orders, and audits the decisions', async () => {
    await ctx
      .http()
      .post(`/api/v1/public/storefronts/${slug}/visits`)
      .expect(204);
    const settings = (await get(alice, acmeId, '/storefront').expect(200)).body;
    expect(settings.week.visits).toBe(1);
    expect(settings.week.ordersSent).toBeGreaterThanOrEqual(5);
    expect(settings.week.ordersAccepted).toBe(1);
    const { rows } = await ctx.admin.query(
      `select action from app.audit_logs where organization_id = $1`,
      [acmeId],
    );
    const actions = rows.map((r: { action: string }) => r.action);
    for (const action of [
      'storefront.enabled',
      'storefront.address_changed',
      'storefront.articles_updated',
      'order.storefront_received',
      'order.accepted',
      'order.rescheduled',
      'order.declined',
    ])
      expect(actions).toContain(action);
  });

  it('takes no payment for an order to confirm, even in SQL', async () => {
    const sent = await send(slug, { name: 'Test SQL' }).expect(201);
    const { rows } = await ctx.admin.query(
      `select id from app.orders where organization_id = $1 and number = $2`,
      [acmeId, sent.body.number],
    );
    await expect(
      ctx.admin.query(
        `insert into app.order_payments
           (organization_id, order_id, kind, method, amount, client_operation_id, created_by)
         values ($1, $2, 'deposit', 'cash', 100, gen_random_uuid(), $3)`,
        [acmeId, rows[0].id, alice.id],
      ),
    ).rejects.toThrow(/takes no payment/);
  });

  it('erases the name and number of a refused request after the retention days', async () => {
    await ctx.admin.query(
      `update app.orders set cancelled_at = now() - interval '200 days'
        where organization_id = $1 and requester_name = 'Oumar Sow'`,
      [acmeId],
    );
    const { DailyService } =
      await import('../src/notifications/daily.service.js');
    const daily = ctx.app.get(DailyService);
    expect(await daily.forgetDeclinedRequesters()).toBe(1);
    const { rows } = await ctx.admin.query(
      `select requester_name, requester_phone, cancellation_reason
         from app.orders where organization_id = $1 and status = 'cancelled'
          and customer_id is null`,
      [acmeId],
    );
    expect(rows[0]).toMatchObject({
      requester_name: '',
      requester_phone: '',
    });
  });

  it('serves the shop settings only to its members', async () => {
    await get(bob, acmeId, '/storefront').expect(404);
    await get(dan, acmeId, '/storefront').expect(200);
    await get(dan, acmeId, '/storefront/articles').expect(403);
    void hidden;
  });
});
