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
      ctx.createUser(),
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
    await ctx.admin.query(
      `insert into app.platform_admins (user_id, note) values ($1, 'test')`,
      [zed.id],
    );
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
  });

  it('never opens the business content of a shop', async () => {
    // An administrator is not a member: shop routes stay closed.
    await get(zed, acmeId, '/products').expect(404);
    await get(zed, acmeId, '/sales').expect(404);
    const detail = (await admin(`/shops/${acmeId}`).expect(200)).body;
    expect(Object.keys(detail).sort()).toEqual(
      [
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
    });
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
    const overview = (await admin('/overview').expect(200)).body;
    expect(overview.pendingRequests).toBe(1);
    expect(overview.alerts).toContainEqual(
      expect.objectContaining({ kind: 'plan_request' }),
    );
    const [request] = (await admin('/plan-requests').expect(200)).body;
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
      limits: { products: 5000 },
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
    const [request] = (await admin('/plan-requests').expect(200)).body;
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
      (await admin('/plan-requests?status=all').expect(200)).body,
    ).toHaveLength(2);

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
      limits: { products: 500, members: 5, devices: 3 },
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

  it('keeps what devices sent, even in SQL', async () => {
    await expect(
      ctx.admin.query('delete from app.sync_batches'),
    ).rejects.toThrow(/append-only/);
    await expect(
      ctx.admin.query('update app.sync_rejections set code = $1', ['X']),
    ).rejects.toThrow(/append-only/);
  });
});
