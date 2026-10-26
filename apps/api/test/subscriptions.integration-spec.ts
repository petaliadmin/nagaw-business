import { randomUUID } from 'node:crypto';
import type { TestContext, TestUser } from './support/app.js';
import { createTestContext } from './support/app.js';

describe('Offers, subscriptions and quotas', () => {
  let ctx: TestContext;
  let alice: TestUser; // owner of Acme
  let bob: TestUser; // owner of Globex
  let carol: TestUser; // manager (admin) of Acme, added later
  let dan: TestUser; // invited to Acme
  let acmeId: string;
  let globexId: string;
  let danToken: string; // invitation of Dan to Acme

  const as = (user: TestUser, orgId?: string) => ({
    Authorization: `Bearer ${user.token}`,
    ...(orgId && { 'X-Organization-Id': orgId }),
  });
  const get = (user: TestUser, orgId: string, path: string) =>
    ctx.http().get(`/api/v1${path}`).set(as(user, orgId));
  const post = (
    user: TestUser,
    orgId: string,
    path: string,
    body: object = {},
  ) => ctx.http().post(`/api/v1${path}`).set(as(user, orgId)).send(body);
  const product = (name: string, user = alice, orgId = acmeId) =>
    post(user, orgId, '/products', {
      name,
      unit: 'piece',
      salePrice: 100,
      categoryId: null,
      purchasePrice: null,
      taxRateId: null,
      barcode: null,
      lowStockThreshold: null,
      trackStock: false,
      clientOperationId: randomUUID(),
    });
  const device = (user = alice, orgId = acmeId) =>
    post(user, orgId, '/devices', {
      label: 'Téléphone',
      clientOperationId: randomUUID(),
    });
  const invite = (email: string, user = alice, orgId = acmeId) =>
    post(user, orgId, '/organizations/current/invitations', {
      email,
      role: 'member',
    });

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
          .set(as(user))
          .send({ name })
          .expect(201)
      ).body.id as string;
    acmeId = await createOrg(alice, 'Acme Dakar');
    globexId = await createOrg(bob, 'Globex');
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('lists the offers to any signed-in person', async () => {
    const plans = (
      await ctx.http().get('/api/v1/plans').set(as(dan)).expect(200)
    ).body;
    expect(plans).toEqual([
      {
        key: 'free',
        name: 'Gratuit',
        monthlyPrice: 0,
        currency: 'XOF',
        limits: { products: 3, members: 2, devices: 1 },
      },
      {
        key: 'essential',
        name: 'Essentiel',
        monthlyPrice: 5000,
        currency: 'XOF',
        limits: { products: 10, members: 5, devices: 3 },
      },
      {
        key: 'pro',
        name: 'Pro',
        monthlyPrice: 15000,
        currency: 'XOF',
        limits: { products: null, members: 20, devices: 10 },
      },
    ]);
    await ctx.http().get('/api/v1/plans').expect(401);
  });

  it('starts a new shop on the free offer, with its limits', async () => {
    const s = (await get(alice, acmeId, '/subscription').expect(200)).body;
    expect(s).toMatchObject({
      plan: { key: 'free' },
      limits: { products: 3, members: 2, devices: 1 },
      usage: { products: 0, members: 1, devices: 0 },
      pendingRequest: null,
    });
  });

  it('applies the free offer to products, devices and people', async () => {
    for (let i = 1; i <= 3; i++) await product(`Article ${i}`).expect(201);
    const refused = await product('Article 4').expect(409);
    expect(refused.body.error.message).toBe(
      'Limite de 3 produits atteinte. Changez d’offre dans « Abonnement » pour en ajouter.',
    );
    await device().expect(201);
    expect((await device().expect(409)).body.error.code).toBe(
      'CATALOG_LIMIT_REACHED',
    );

    // Two people: Alice and one invitation already fill the shop.
    danToken = (await invite(dan.email).expect(201)).body.token;
    const full = await invite('autre@example.test').expect(409);
    expect(full.body.error.code).toBe('MEMBER_LIMIT_REACHED');
    expect(
      (await get(alice, acmeId, '/subscription').expect(200)).body.usage,
    ).toEqual({
      products: 3,
      members: 1,
      devices: 1,
    });
  }, 60_000);

  it('gives the shop the limits of its new offer, keeping what it has when it goes down', async () => {
    await ctx.setPlan(acmeId, 'essential');
    expect(
      (await get(alice, acmeId, '/subscription').expect(200)).body,
    ).toMatchObject({
      plan: { key: 'essential', name: 'Essentiel' },
      limits: { products: 10, members: 5, devices: 3 },
    });
    await product('Article 4').expect(201);
    await device().expect(201);
    await invite('autre@example.test').expect(201);

    await ctx.setPlan(acmeId, 'free');
    const s = (await get(alice, acmeId, '/subscription').expect(200)).body;
    expect(s.usage).toEqual({ products: 4, members: 1, devices: 2 });
    expect(s.limits).toEqual({ products: 3, members: 2, devices: 1 });
    // Nothing is taken away; nothing more can be added.
    expect(
      (await get(alice, acmeId, '/products').expect(200)).body,
    ).toHaveLength(4);
    await product('Article 5').expect(409);
    await device().expect(409);
  });

  it('sets no product limit on the Pro offer', async () => {
    await ctx.setPlan(acmeId, 'pro');
    const s = (await get(alice, acmeId, '/subscription').expect(200)).body;
    expect(s.limits).toEqual({ products: null, members: 20, devices: 10 });
    // Beyond the 10 of Essentiel: 4 already, 7 more.
    for (let i = 5; i <= 11; i++) await product(`Article ${i}`).expect(201);
    expect(
      (await get(alice, acmeId, '/subscription').expect(200)).body.usage
        .products,
    ).toBe(11);
    await ctx.setPlan(acmeId, 'free');
  }, 60_000);

  it('refuses a new member beyond the offer when an invitation is accepted', async () => {
    await ctx.setPlan(acmeId, 'essential');
    await ctx.admin.query(
      `insert into app.organization_memberships (organization_id, user_id, role) values ($1, $2, 'admin')`,
      [acmeId, carol.id],
    );
    await ctx.setPlan(acmeId, 'free'); // Alice and Carol: full
    const refused = await ctx
      .http()
      .post('/api/v1/invitations/accept')
      .set(as(dan))
      .send({ token: danToken })
      .expect(409);
    expect(refused.body.error.code).toBe('MEMBER_LIMIT_REACHED');
  });

  it('lets the owner ask for another offer, once at a time, and change their mind', async () => {
    await get(carol, acmeId, '/subscription').expect(200); // a manager reads
    await post(carol, acmeId, '/subscription/requests', {
      planKey: 'pro',
    }).expect(403);
    await post(alice, acmeId, '/subscription/requests', {
      planKey: 'inconnue',
    }).expect(400);
    await post(alice, acmeId, '/subscription/requests', {
      planKey: 'free',
    }).expect(409); // already
    const asked = (
      await post(alice, acmeId, '/subscription/requests', {
        planKey: 'pro',
      }).expect(201)
    ).body;
    expect(asked.pendingRequest).toMatchObject({
      plan: { key: 'pro', name: 'Pro' },
    });
    const twice = await post(alice, acmeId, '/subscription/requests', {
      planKey: 'essential',
    }).expect(409);
    expect(twice.body.error.code).toBe('PLAN_CHANGE_PENDING');
    // The offer itself only changes when the platform makes the change.
    expect(asked.plan.key).toBe('free');

    const audit = (await get(alice, acmeId, '/audit-logs?limit=5').expect(200))
      .body.data;
    expect(audit[0]).toMatchObject({
      action: 'subscription.change_requested',
      metadata: { from: 'free', to: 'pro' },
    });

    const cancelled = (
      await post(alice, acmeId, '/subscription/requests/cancel').expect(200)
    ).body;
    expect(cancelled.pendingRequest).toBeNull();
    await post(alice, acmeId, '/subscription/requests/cancel').expect(409);
    await post(alice, acmeId, '/subscription/requests', {
      planKey: 'essential',
    }).expect(201);
  });

  it('never shows nor touches the subscription of another shop', async () => {
    const theirs = (await get(bob, globexId, '/subscription').expect(200)).body;
    expect(theirs).toMatchObject({
      plan: { key: 'free' },
      usage: { products: 0, members: 1, devices: 0 },
      pendingRequest: null,
    });
    // Alice's pending request is not Bob's to cancel.
    await post(bob, globexId, '/subscription/requests/cancel').expect(409);
    expect(
      (await get(alice, acmeId, '/subscription').expect(200)).body
        .pendingRequest,
    ).toMatchObject({
      plan: { key: 'essential' },
    });
    await get(bob, acmeId, '/subscription').expect(404);
    await post(bob, acmeId, '/subscription/requests', {
      planKey: 'pro',
    }).expect(404);
    // Each shop's limits are its own.
    await product('Premier', bob, globexId).expect(201);
  });

  it('keeps requests as a record, even in SQL', async () => {
    const { rows } = await ctx.admin.query(
      'select count(*)::int as n from app.plan_change_requests where organization_id = $1',
      [acmeId],
    );
    expect(rows[0].n).toBeGreaterThan(0);
    await expect(
      ctx.admin.query(
        'delete from app.plan_change_requests where organization_id = $1',
        [acmeId],
      ),
    ).rejects.toThrow(/append-only/);
  });
});
