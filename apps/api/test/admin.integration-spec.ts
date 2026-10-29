import { randomUUID } from 'node:crypto';
import type { TestContext, TestUser } from './support/app.js';
import { createTestContext } from './support/app.js';

describe('Platform administration', () => {
  let ctx: TestContext;
  let alice: TestUser; // owner of Acme
  let bob: TestUser; // owner of Globex
  let zed: TestUser; // platform administrator, member of no shop
  let acmeId: string;
  let globexId: string;
  let water: { id: string };
  let device: { id: string; ticketPrefix: string };

  const bearer = (user: TestUser) => ({
    Authorization: `Bearer ${user.token}`,
  });
  const shopHeaders = (user: TestUser, orgId: string) => ({
    ...bearer(user),
    'X-Organization-Id': orgId,
  });
  const admin = (path: string, user = zed) =>
    ctx.http().get(`/api/v1/admin${path}`).set(bearer(user));
  const adminPost = (path: string, body: object = {}, user = zed) =>
    ctx.http().post(`/api/v1/admin${path}`).set(bearer(user)).send(body);
  /** The requests of one shop: other files ask offers at the same time. */
  const requestsOf = async (shopId: string, path: string) =>
    (
      (await admin(path).expect(200)).body as {
        id: string;
        status: string;
        shop: { id: string };
      }[]
    ).filter((r) => r.shop.id === shopId);
  const post = (
    user: TestUser,
    orgId: string,
    path: string,
    body: object = {},
  ) =>
    ctx.http().post(`/api/v1${path}`).set(shopHeaders(user, orgId)).send(body);
  const get = (user: TestUser, orgId: string, path: string) =>
    ctx.http().get(`/api/v1${path}`).set(shopHeaders(user, orgId));

  beforeAll(async () => {
    ctx = await createTestContext();
    [alice, bob, zed] = await Promise.all([
      ctx.createUser(),
      ctx.createUser(),
      ctx.platformAdmin(),
    ]);
    const createOrg = async (user: TestUser, name: string) =>
      (
        await ctx
          .http()
          .post('/api/v1/organizations')
          .set(bearer(user))
          .send({ name })
          .expect(201)
      ).body.id as string;
    acmeId = await createOrg(alice, 'Acme Dakar');
    globexId = await createOrg(bob, 'Globex');
    water = (
      await post(alice, acmeId, '/products', {
        name: 'Eau',
        unit: 'bouteille',
        salePrice: 500,
        categoryId: null,
        purchasePrice: null,
        taxRateId: null,
        barcode: null,
        lowStockThreshold: null,
        trackStock: false,
        clientOperationId: randomUUID(),
      }).expect(201)
    ).body;
    device = (
      await post(alice, acmeId, '/devices', {
        label: 'Caisse 1',
        clientOperationId: randomUUID(),
      }).expect(201)
    ).body;
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('opens only to platform administrators, checked in the database', async () => {
    for (const path of [
      '/overview',
      '/shops',
      `/shops/${acmeId}`,
      '/plan-requests',
      '/sync',
      '/finances',
      '/activity',
    ]) {
      const refused = await admin(path, alice).expect(403);
      expect(refused.body.error.code).toBe('PLATFORM_ADMIN_REQUIRED');
      await ctx.http().get(`/api/v1/admin${path}`).expect(401);
    }
    await adminPost(
      `/shops/${globexId}/suspend`,
      { reason: 'x' },
      alice,
    ).expect(403);
    expect(
      (await ctx.http().get('/api/v1/me').set(bearer(zed)).expect(200)).body
        .platformAdmin,
    ).toBe(true);
    expect(
      (await ctx.http().get('/api/v1/me').set(bearer(alice)).expect(200)).body
        .platformAdmin,
    ).toBe(false);
    // A dozen requests: room for a busy machine, as in the other loops.
  }, 60_000);

  it('keeps a single platform administrator, even in SQL', async () => {
    await expect(
      ctx.admin.query(
        `insert into app.platform_admins (user_id, note) values ($1, 'second')`,
        [alice.id],
      ),
    ).rejects.toMatchObject({
      code: '23505',
      constraint: 'platform_admins_single',
    });
    await admin('/overview', alice).expect(403);
    const { rows } = await ctx.admin.query(
      'select user_id from app.platform_admins',
    );
    expect(rows).toEqual([{ user_id: zed.id }]);
  });

  it('never opens the business content of a shop', async () => {
    // An administrator is not a member: shop routes stay closed.
    await get(zed, acmeId, '/products').expect(404);
    await get(zed, acmeId, '/sales').expect(404);
    const detail = (await admin(`/shops/${acmeId}`).expect(200)).body;
    expect(Object.keys(detail).sort()).toEqual(
      [
        'access',
        'createdAt',
        'currency',
        'devices',
        'id',
        'lastSaleAt',
        'limits',
        'members',
        'name',
        'ownerEmails',
        'plan',
        'requests',
        'status',
        'suspension',
        'timezone',
        'usage',
      ].sort(),
    );
    expect(detail).toMatchObject({
      name: 'Acme Dakar',
      ownerEmails: [alice.email],
      plan: { key: 'free' },
      usage: { products: 1, members: 1, devices: 1 },
      access: null,
    });
  });

  it('enters a shop with a reason, as its owner, signed by the platform, until closed', async () => {
    const access = (orgId: string, body: object, user = zed) =>
      adminPost(`/shops/${orgId}/access`, body, user);
    await access(acmeId, { reason: 'Aide' }, alice).expect(403);
    await access(acmeId, { reason: '' }).expect(400);
    await access(randomUUID(), { reason: 'Aide' }).expect(404);

    const opened = (
      await access(acmeId, { reason: 'Aide à la saisie du stock' }).expect(200)
    ).body;
    expect(opened.access).toMatchObject({
      reason: 'Aide à la saisie du stock',
    });
    expect(
      (await access(acmeId, { reason: 'Encore' }).expect(409)).body.error.code,
    ).toBe('ACCESS_ALREADY_OPEN');

    // Inside Acme with the rights of an owner; Globex stays closed.
    await get(zed, acmeId, '/products').expect(200);
    await get(zed, acmeId, '/organizations/current/members').expect(200);
    await get(zed, globexId, '/products').expect(404);
    const shops = (
      await ctx.http().get('/api/v1/me').set(bearer(zed)).expect(200)
    ).body.organizations;
    expect(shops).toEqual([
      expect.objectContaining({
        id: acmeId,
        role: 'owner',
        platformAccess: true,
      }),
    ]);
    // Not a member: the team of the shop is unchanged.
    expect(
      (
        await get(alice, acmeId, '/organizations/current/members').expect(200)
      ).body.map((m: { userId: string }) => m.userId),
    ).toEqual([alice.id]);

    const product = (
      await post(zed, acmeId, '/products', {
        name: 'Riz',
        unit: 'kg',
        salePrice: 650,
        categoryId: null,
        purchasePrice: null,
        taxRateId: null,
        barcode: null,
        lowStockThreshold: null,
        trackStock: false,
        clientOperationId: randomUUID(),
      }).expect(201)
    ).body;

    await adminPost(`/shops/${acmeId}/access/close`).expect(200);
    await adminPost(`/shops/${acmeId}/access/close`).expect(409);
    await get(zed, acmeId, '/products').expect(404);
    expect(
      (await ctx.http().get('/api/v1/me').set(bearer(zed)).expect(200)).body
        .organizations,
    ).toEqual([]);

    // The owner sees all of it in the history, done by the platform.
    const history = (
      await get(alice, acmeId, '/audit-logs?limit=20').expect(200)
    ).body.data as {
      actorType: string;
      actorId: string;
      action: string;
      targetId: string | null;
      metadata: Record<string, unknown>;
    }[];
    const byZed = history.filter((e) => e.actorId === zed.id);
    expect(byZed.map((e) => e.action)).toEqual(
      expect.arrayContaining([
        'platform.access_opened',
        'platform.access_closed',
      ]),
    );
    expect(byZed.find((e) => e.targetId === product.id)).toBeDefined();
    expect(byZed.every((e) => e.actorType === 'platform_admin')).toBe(true);
    expect(
      byZed.find((e) => e.action === 'platform.access_opened')?.metadata,
    ).toEqual({ reason: 'Aide à la saisie du stock' });
    const globexHistory = (
      await get(bob, globexId, '/audit-logs?limit=20').expect(200)
    ).body.data as { actorId: string }[];
    expect(globexHistory.some((e) => e.actorId === zed.id)).toBe(false);

    // A suspended shop cannot be entered.
    await ctx.admin.query(
      `update app.organizations set status = 'suspended', suspended_at = now(),
              suspension_reason = 'Test' where id = $1`,
      [globexId],
    );
    expect(
      (await access(globexId, { reason: 'Voir' }).expect(409)).body.error.code,
    ).toBe('SHOP_SUSPENDED');
    await ctx.admin.query(
      `update app.organizations set status = 'active', suspended_at = null,
              suspension_reason = null where id = $1`,
      [globexId],
    );
  });

  it('lists and finds shops by name or owner', async () => {
    const all = (await admin('/shops').expect(200)).body;
    expect(all.map((s: { name: string }) => s.name)).toEqual(
      expect.arrayContaining(['Acme Dakar', 'Globex']),
    );
    // Other test files share the database: look at our own shops only.
    const ids = async (path: string) =>
      (await admin(path).expect(200)).body.map((s: { id: string }) => s.id);
    const byName = await ids('/shops?q=glob');
    expect(byName).toContain(globexId);
    expect(byName).not.toContain(acmeId);
    expect(await ids(`/shops?q=${encodeURIComponent(alice.email)}`)).toEqual([
      acmeId,
    ]);
    // `%` is searched as a character, not as a wildcard.
    expect(await ids('/shops?q=100%25')).not.toContain(acmeId);
    await admin(`/shops/${randomUUID()}`).expect(404);
  });

  it('approves a request to change offer, audited in the shop history', async () => {
    await post(alice, acmeId, '/subscription/requests', {
      planKey: 'pro',
    }).expect(201);
    // Other files ask offers at the same time: look at Acme's request.
    const overview = (await admin('/overview').expect(200)).body;
    expect(overview.pendingRequests).toBeGreaterThanOrEqual(1);
    expect(overview.alerts).toContainEqual(
      expect.objectContaining({ kind: 'plan_request' }),
    );
    const ofAcme = (await requestsOf(acmeId, '/plan-requests')).filter(
      (r) => r.status === 'pending',
    );
    expect(ofAcme).toHaveLength(1);
    const [request] = ofAcme;
    if (!request) throw new Error('No pending request for Acme');
    expect(request).toMatchObject({
      shop: { id: acmeId },
      from: { key: 'free' },
      to: { key: 'pro' },
      requestedBy: alice.email,
    });

    const done = (
      await adminPost(`/plan-requests/${request.id}/approve`, {
        note: 'Payé par Wave',
      }).expect(200)
    ).body;
    expect(done).toMatchObject({ status: 'done', note: 'Payé par Wave' });
    await adminPost(`/plan-requests/${request.id}/approve`).expect(409);
    const subscription = (await get(alice, acmeId, '/subscription').expect(200))
      .body;
    expect(subscription).toMatchObject({
      plan: { key: 'pro' },
      limits: { products: null },
      pendingRequest: null,
    });
    const history = (
      await get(alice, acmeId, '/audit-logs?limit=3').expect(200)
    ).body.data;
    expect(history[0]).toMatchObject({
      actorType: 'platform_admin',
      actorId: zed.id,
      action: 'subscription.plan_changed',
      metadata: { from: 'free', to: 'pro' },
    });
  });

  it('rejects a request, and changes an offer directly', async () => {
    await post(alice, acmeId, '/subscription/requests', {
      planKey: 'essential',
    }).expect(201);
    const [request] = await requestsOf(acmeId, '/plan-requests');
    if (!request) throw new Error('No request for Acme');
    const rejected = (
      await adminPost(`/plan-requests/${request.id}/reject`, {
        note: 'Pas de paiement reçu',
      }).expect(200)
    ).body;
    expect(rejected.status).toBe('rejected');
    expect(
      (await get(alice, acmeId, '/subscription').expect(200)).body.plan.key,
    ).toBe('pro');
    expect(
      (await requestsOf(acmeId, '/plan-requests?status=all')).map(
        (r) => r.status,
      ),
    ).toEqual(['rejected', 'done']);

    await adminPost(`/shops/${globexId}/plan`, { planKey: 'inconnue' }).expect(
      400,
    );
    await adminPost(`/shops/${globexId}/plan`, { planKey: 'free' }).expect(409);
    const changed = (
      await adminPost(`/shops/${globexId}/plan`, {
        planKey: 'essential',
        note: 'Geste commercial',
      }).expect(200)
    ).body;
    expect(changed).toMatchObject({
      plan: { key: 'essential' },
      limits: { products: 10, members: 5, devices: 3 },
    });
  });

  it('suspends a shop, closing it to its members, then reactivates it', async () => {
    const before = (await admin('/overview').expect(200)).body.shops;
    await adminPost(`/shops/${globexId}/suspend`, { reason: '' }).expect(400);
    const suspended = (
      await adminPost(`/shops/${globexId}/suspend`, {
        reason: 'Fraude signalée',
      }).expect(200)
    ).body;
    expect(suspended).toMatchObject({
      status: 'suspended',
      suspension: { reason: 'Fraude signalée' },
    });
    await adminPost(`/shops/${globexId}/suspend`, { reason: 'Encore' }).expect(
      409,
    );
    await get(bob, globexId, '/organizations/current').expect(404);
    expect(
      (await ctx.http().get('/api/v1/me').set(bearer(bob)).expect(200)).body
        .organizations,
    ).toEqual([]);
    // Other files create shops at the same time: suspended ones only grow.
    const after = (await admin('/overview').expect(200)).body.shops;
    expect(after.suspended).toBeGreaterThanOrEqual(before.suspended + 1);
    expect(
      (await admin('/shops?status=suspended').expect(200)).body.map(
        (s: { id: string }) => s.id,
      ),
    ).toContain(globexId);

    const back = (await adminPost(`/shops/${globexId}/reactivate`).expect(200))
      .body;
    expect(back).toMatchObject({ status: 'active', suspension: null });
    await adminPost(`/shops/${globexId}/reactivate`).expect(409);
    await get(bob, globexId, '/organizations/current').expect(200);
  });

  it('measures synchronization and raises alerts from thresholds in base', async () => {
    // Other test files sync too: count what this test adds.
    const dayBefore = (await admin('/sync?days=7').expect(200)).body.days.at(
      -1,
    );
    const syncBefore = (await admin('/overview').expect(200)).body.sync;
    const sale = (overrides: object = {}) => ({
      type: 'sale',
      clientOperationId: randomUUID(),
      data: {
        deviceTicket: `${device.ticketPrefix}-${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}`,
        occurredAt: new Date(Date.now() - 60 * 1000).toISOString(),
        lines: [{ productId: water.id, quantity: 1, unitPrice: 500 }],
        payments: [{ method: 'cash', amount: 500 }],
        ...overrides,
      },
    });
    const res = await post(alice, acmeId, '/sync', {
      deviceId: device.id,
      operations: [
        sale(),
        sale({
          lines: [{ productId: randomUUID(), quantity: 1, unitPrice: 500 }],
        }),
      ],
    }).expect(200);
    expect(res.body.results.map((r: { status: string }) => r.status)).toEqual([
      'accepted',
      'rejected',
    ]);

    // Recorded exactly for this shop…
    const { rows } = await ctx.admin.query(
      `select b.accepted, b.duplicates, b.rejected, r.code
         from app.sync_batches b
         join app.sync_rejections r on r.batch_id = b.id
        where b.organization_id = $1`,
      [acmeId],
    );
    expect(rows).toEqual([
      { accepted: 1, duplicates: 0, rejected: 1, code: expect.any(String) },
    ]);
    // …and counted in the platform totals (other files sync at the same time).
    const sync = (await admin('/sync?days=7').expect(200)).body;
    expect(sync.days).toHaveLength(7);
    const day = sync.days.at(-1);
    expect(day.batches).toBeGreaterThanOrEqual(dayBefore.batches + 1);
    expect(day.accepted).toBeGreaterThanOrEqual(dayBefore.accepted + 1);
    expect(day.rejected).toBeGreaterThanOrEqual(dayBefore.rejected + 1);
    expect(sync.reasons.map((r: { code: string }) => r.code)).toContain(
      rows[0].code,
    );
    const overview = (await admin('/overview').expect(200)).body;
    expect(overview.sync.batches).toBeGreaterThanOrEqual(
      syncBefore.batches + 1,
    );
    expect(overview.sync.rejected).toBeGreaterThanOrEqual(
      syncBefore.rejected + 1,
    );
    expect(overview.alerts).toContainEqual(
      expect.objectContaining({
        kind: 'sync_rejections',
        shop: { id: acmeId, name: 'Acme Dakar' },
      }),
    );

    // A device silent beyond the threshold in base.
    await ctx.admin.query(
      `update app.devices set last_synced_at = now() - interval '10 days' where id = $1`,
      [device.id],
    );
    const silentOfAcme = async () =>
      (await admin('/sync').expect(200)).body.silentDevices.filter(
        (d: { shop: { id: string } }) => d.shop.id === acmeId,
      );
    expect(await silentOfAcme()).toEqual([
      expect.objectContaining({
        label: 'Caisse 1',
        shop: { id: acmeId, name: 'Acme Dakar' },
      }),
    ]);
    await ctx.admin.query(
      'update app.platform_settings set silent_device_days = 30',
    );
    expect(await silentOfAcme()).toEqual([]);
    // Shared settings: put the default back for the other tests.
    await ctx.admin.query(
      'update app.platform_settings set silent_device_days = 3',
    );

    // A quota nearly used: Globex on Essentiel with its 3 devices.
    for (let i = 0; i < 3; i++)
      await post(bob, globexId, '/devices', {
        label: `T${i}`,
        clientOperationId: randomUUID(),
      }).expect(201);
    expect((await admin('/overview').expect(200)).body.alerts).toContainEqual(
      expect.objectContaining({
        kind: 'quota',
        shop: { id: globexId, name: 'Globex' },
      }),
    );
  });

  it('expects revenue from the offers, month by month from the history', async () => {
    // A shop opened nine months ago (UTC months): free, then Essentiel,
    // suspended for a month, then Pro. Other files only create shops now,
    // so the past months hold this shop alone.
    const carl = await ctx.createUser();
    const oldId = (
      await ctx
        .http()
        .post('/api/v1/organizations')
        .set(bearer(carl))
        .send({ name: 'Ancienne boutique' })
        .expect(201)
    ).body.id as string;
    const at = (monthsAgo: number, day: number) =>
      `(date_trunc('month', now() at time zone 'UTC') - interval '${monthsAgo} months' + interval '${day} days') at time zone 'UTC'`;
    await ctx.admin.query(
      `update app.organizations set created_at = ${at(9, 2)} where id = $1`,
      [oldId],
    );
    const event = (action: string, when: string, metadata: object) =>
      ctx.admin.query(
        `insert into app.audit_logs (organization_id, actor_type, actor_id, action, target_type, target_id, metadata, created_at)
         values ($1::uuid, 'platform_admin', $2, $3, 'organization', $1::text, $4, ${when})`,
        [oldId, zed.id, action, JSON.stringify(metadata)],
      );
    await event('subscription.plan_changed', at(7, 4), {
      from: 'free',
      to: 'essential',
    });
    await event('organization.suspended', at(5, 3), { reason: 'Test' });
    await event('organization.reactivated', at(4, 3), {});
    await event('subscription.plan_changed', at(3, 1), {
      from: 'essential',
      to: 'pro',
    });
    await ctx.setPlan(oldId, 'pro');

    const finances = (await admin('/finances').expect(200)).body;
    expect(finances.currency).toBe('XOF');
    expect(finances.months).toHaveLength(12);
    // Months 11 to 1 ago, oldest first; the current month holds every shop.
    expect(
      finances.months
        .slice(0, 11)
        .map(
          (m: {
            expectedMonthlyRevenue: number;
            payingShops: number;
            upgrades: number;
          }) => [m.expectedMonthlyRevenue, m.payingShops, m.upgrades],
        ),
    ).toEqual([
      [0, 0, 0], // 11: not yet open
      [0, 0, 0], // 10
      [0, 0, 0], // 9: free, told by the first change
      [0, 0, 0], // 8
      [5000, 1, 1], // 7: Essentiel
      [5000, 1, 0], // 6
      [0, 0, 0], // 5: suspended at the end of the month
      [5000, 1, 0], // 4: reactivated
      [15000, 1, 1], // 3: Pro
      [15000, 1, 0], // 2
      [15000, 1, 0], // 1
    ]);
    // Today: the offers of the active shops, at their prices.
    for (const plan of finances.byPlan)
      expect(plan.expectedMonthlyRevenue).toBe(plan.monthlyPrice * plan.shops);
    expect(finances.expectedMonthlyRevenue).toBe(
      finances.byPlan.reduce(
        (sum: number, p: { expectedMonthlyRevenue: number }) =>
          sum + p.expectedMonthlyRevenue,
        0,
      ),
    );
    expect(
      finances.byPlan.find((p: { key: string }) => p.key === 'pro').shops,
    ).toBeGreaterThanOrEqual(2); // Acme and the old shop

    // The asked offers: what they would add each month.
    await post(bob, globexId, '/subscription/requests', {
      planKey: 'pro',
    }).expect(201);
    const asked = (await admin('/finances').expect(200)).body.pending;
    expect(asked.requests).toBeGreaterThanOrEqual(1);
    expect(asked.expectedMonthlyChange).toBeGreaterThanOrEqual(10000);
    await post(bob, globexId, '/subscription/requests/cancel').expect(200);

    const activity = (await admin('/activity').expect(200)).body;
    expect(activity.currency).toBe('XOF');
    expect(activity.days).toHaveLength(30);
    expect(activity.months).toHaveLength(12);
    expect(activity.months[2]).toMatchObject({ newShops: 1, newUsers: 0 });
    // Acme sold a bottle of water in the synchronization test.
    expect(activity.days.at(-1).amount).toBeGreaterThanOrEqual(500);
    expect(activity.shopsSelling.last7Days).toBeGreaterThanOrEqual(1);
    expect(activity.topShops.length).toBeLessThanOrEqual(5);
  });

  it('keeps what devices sent, even in SQL', async () => {
    await expect(
      ctx.admin.query('delete from app.sync_batches'),
    ).rejects.toThrow(/append-only/);
    await expect(
      ctx.admin.query('update app.sync_rejections set code = $1', ['X']),
    ).rejects.toThrow(/append-only/);
  });
});
