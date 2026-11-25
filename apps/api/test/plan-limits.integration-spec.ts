import { randomUUID } from 'node:crypto';
import type { AdminPlanUpdateInput } from '@nagaw/shared';
import type { TestContext, TestUser } from './support/app.js';
import { createTestContext } from './support/app.js';

/**
 * Limits of an offer set from the administration (ADR-075). The shops of
 * this file are on offers of their own, so that the shared offers (free,
 * essential, pro) of the other files never change.
 */
describe('Limits of the offers (ADR-075)', () => {
  let ctx: TestContext;
  let root: TestUser; // platform administrator
  let alice: TestUser; // owner of Acme
  let bob: TestUser; // owner of Globex
  let acmeId: string;
  let globexId: string;
  let acmePlan: string;
  let globexPlan: string;

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
  const patch = (user: TestUser, orgId: string, path: string, body: object) =>
    ctx.http().patch(`/api/v1${path}`).set(as(user, orgId)).send(body);
  const adminGet = (path: string) =>
    ctx.http().get(`/api/v1/admin${path}`).set(as(root));
  const adminPatch = (path: string, body: object) =>
    ctx.http().patch(`/api/v1/admin${path}`).set(as(root)).send(body);

  const NO_LIMITS: AdminPlanUpdateInput['limits'] = {
    products: null,
    members: 20,
    devices: 10,
    salesPerMonth: null,
    invoicesPerMonth: null,
    quotesPerMonth: null,
    customers: null,
    suppliers: null,
    historyMonths: null,
    modules: ['accounting', 'treasury', 'orders', 'statistics'],
  };
  const setPlan = (
    key: string,
    limits: Partial<AdminPlanUpdateInput['limits']> = {},
  ) =>
    adminPatch(`/plans/${key}`, {
      monthlyPrice: 2000,
      yearlyPrice: null,
      limits: { ...NO_LIMITS, ...limits },
    });

  /** An offer of this file only: lower-case letters, unique per run. */
  const newPlan = async () => {
    const key = `t_${randomUUID()
      .replace(/[^a-f]/g, '')
      .slice(0, 12)}`;
    await ctx.admin.query(
      `insert into app.plans (key, name, monthly_price, max_products, max_members, max_devices, position)
       values ($1, 'Essai', 2000, null, 20, 10, 99)`,
      [key],
    );
    return key;
  };
  const customer = (name: string, orgId = acmeId, user = alice) =>
    post(user, orgId, '/customers', {
      name,
      clientOperationId: randomUUID(),
    });
  const serviceLine = {
    label: 'Livraison à domicile',
    unit: 'piece',
    quantity: 1,
    unitPrice: 1500,
  };

  let water: { id: string } | undefined;
  /** One sale of 500 F at Acme, paid in cash. */
  const sell = async () => {
    water ??= (
      await post(alice, acmeId, '/products', {
        name: 'Eau',
        unit: 'piece',
        salePrice: 500,
        categoryId: null,
        purchasePrice: null,
        taxRateId: null,
        barcode: null,
        lowStockThreshold: null,
        trackStock: false,
        clientOperationId: randomUUID(),
      }).expect(201)
    ).body as { id: string };
    return post(alice, acmeId, '/sales', {
      lines: [{ productId: water.id, quantity: 1 }],
      payments: [{ method: 'cash', amount: 500 }],
      expectedTotal: 500,
      clientOperationId: randomUUID(),
    }).expect(201);
  };

  beforeAll(async () => {
    ctx = await createTestContext();
    root = await ctx.platformAdmin();
    [alice, bob] = await Promise.all([ctx.createUser(), ctx.createUser()]);
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
    [acmePlan, globexPlan] = await Promise.all([newPlan(), newPlan()]);
    await ctx.setPlan(acmeId, acmePlan);
    await ctx.setPlan(globexId, globexPlan);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('lets only the platform administrator read and change the offers', async () => {
    const plans = (await adminGet('/plans').expect(200)).body as {
      key: string;
      shops: number;
      limits: object;
    }[];
    expect(plans.find((p) => p.key === acmePlan)).toMatchObject({
      shops: 1,
      limits: NO_LIMITS,
    });
    await ctx.http().get('/api/v1/admin/plans').set(as(alice)).expect(403);
    await ctx
      .http()
      .patch(`/api/v1/admin/plans/${acmePlan}`)
      .set(as(alice))
      .send({ monthlyPrice: 0, yearlyPrice: null, limits: NO_LIMITS })
      .expect(403);
    await setPlan('nope').expect(404);
    // At least 3 months of history: the home page compares two months.
    await setPlan(acmePlan, { historyMonths: 1 }).expect(400);
  });

  it('keeps each change with its author, and applies the caps to the shops', async () => {
    const changed = (
      await setPlan(acmePlan, { members: 4, customers: 50 }).expect(200)
    ).body;
    expect(changed.limits).toMatchObject({ members: 4, customers: 50 });
    expect(changed.revisions[0]).toMatchObject({
      planKey: acmePlan,
      before: { limits: { members: 20, customers: null } },
      after: { limits: { members: 4, customers: 50 } },
    });
    const sub = (await get(alice, acmeId, '/subscription').expect(200)).body;
    expect(sub.limits).toMatchObject({ members: 4, customers: 50 });
    // The other shop's offer did not move.
    const theirs = (await get(bob, globexId, '/subscription').expect(200)).body;
    expect(theirs.limits).toMatchObject({ members: 20, customers: null });
    await setPlan(acmePlan).expect(200);
  });

  it('closes the modules an offer leaves out, to that shop only', async () => {
    await setPlan(acmePlan, { modules: ['orders'] }).expect(200);
    const refused = await get(alice, acmeId, '/accounting/journal').expect(403);
    expect(refused.body.error.code).toBe('MODULE_NOT_IN_PLAN');
    await get(alice, acmeId, '/treasury').expect(403);
    await get(alice, acmeId, '/expenses').expect(403);
    await get(alice, acmeId, '/orders').expect(200);
    // The home page's figures stay open.
    await get(alice, acmeId, '/stats/summary').expect(200);
    await get(bob, globexId, '/accounting/journal').expect(200);
    await get(bob, globexId, '/treasury').expect(200);
    // The menus know it.
    const orgs = (await ctx.http().get('/api/v1/me').set(as(alice)).expect(200))
      .body.organizations as { id: string; planModules: string[] }[];
    expect(orgs.find((o) => o.id === acmeId)?.planModules).toEqual(['orders']);
    const current = (
      await get(alice, acmeId, '/organizations/current').expect(200)
    ).body;
    expect(current).toMatchObject({
      planModules: ['orders'],
      historyMonths: null,
    });
    await setPlan(acmePlan).expect(200);
    await get(alice, acmeId, '/accounting/journal').expect(200);
  });

  it('refuses a customer beyond the offer, except one made at the till offline', async () => {
    await setPlan(acmePlan, { customers: 1 }).expect(200);
    await customer('Awa').expect(201);
    const refused = await customer('Binta').expect(409);
    expect(refused.body.error.code).toBe('PLAN_LIMIT_REACHED');
    // Globex has no cap.
    await customer('Coumba', globexId, bob).expect(201);
    await customer('Dieynaba', globexId, bob).expect(201);

    const device = (
      await post(alice, acmeId, '/devices', {
        label: 'Caisse',
        clientOperationId: randomUUID(),
      }).expect(201)
    ).body;
    const synced = await post(alice, acmeId, '/sync', {
      deviceId: device.id,
      operations: [
        {
          type: 'customer',
          clientOperationId: randomUUID(),
          data: { name: 'Fatou', phone: '' },
        },
      ],
    }).expect(200);
    expect(synced.body.results[0].status).toBe('accepted');

    const sub = (await get(alice, acmeId, '/subscription').expect(200)).body;
    expect(sub.usage.customers).toBe(2);
    await setPlan(acmePlan).expect(200);
  });

  it('refuses a supplier beyond the offer, and putting one back', async () => {
    await setPlan(acmePlan, { suppliers: 1 }).expect(200);
    const first = (
      await post(alice, acmeId, '/suppliers', { name: 'Sandaga' }).expect(201)
    ).body;
    const refused = await post(alice, acmeId, '/suppliers', {
      name: 'Tilène',
    }).expect(409);
    expect(refused.body.error.code).toBe('PLAN_LIMIT_REACHED');
    await patch(alice, acmeId, `/suppliers/${first.id}`, {
      status: 'archived',
    }).expect(200);
    const second = (
      await post(alice, acmeId, '/suppliers', { name: 'Tilène' }).expect(201)
    ).body;
    expect(second.name).toBe('Tilène');
    const back = await patch(alice, acmeId, `/suppliers/${first.id}`, {
      status: 'active',
    }).expect(409);
    expect(back.body.error.code).toBe('PLAN_LIMIT_REACHED');
    await setPlan(acmePlan).expect(200);
  });

  it('counts the invoices and quotes of the month, never the credit notes', async () => {
    const client = (
      await customer('Client des factures', globexId, bob).expect(201)
    ).body;
    await setPlan(globexPlan, {
      invoicesPerMonth: 1,
      quotesPerMonth: 1,
    }).expect(200);
    const draft = (
      await post(bob, globexId, '/invoices', {
        customerId: client.id,
        lines: [serviceLine],
        clientOperationId: randomUUID(),
      }).expect(201)
    ).body;
    const refused = await post(bob, globexId, '/invoices', {
      customerId: client.id,
      lines: [serviceLine],
      clientOperationId: randomUUID(),
    }).expect(409);
    expect(refused.body.error.code).toBe('PLAN_LIMIT_REACHED');
    // Issued then cancelled: the credit note is never refused.
    await post(bob, globexId, `/invoices/${draft.id}/issue`).expect(200);
    await post(bob, globexId, `/invoices/${draft.id}/cancel`, {
      reason: 'Erreur de client',
      clientOperationId: randomUUID(),
    }).expect(200);

    await post(bob, globexId, '/quotes', {
      customerId: client.id,
      lines: [serviceLine],
      clientOperationId: randomUUID(),
    }).expect(201);
    await post(bob, globexId, '/quotes', {
      customerId: client.id,
      lines: [serviceLine],
      clientOperationId: randomUUID(),
    }).expect(409);
    const sub = (await get(bob, globexId, '/subscription').expect(200)).body;
    expect(sub.usage).toMatchObject({
      invoicesThisMonth: 1,
      quotesThisMonth: 1,
    });
    await setPlan(globexPlan).expect(200);
  });

  it('never refuses a sale over the month, and the administration sees it', async () => {
    await setPlan(acmePlan, { salesPerMonth: 1 }).expect(200);
    await sell();
    await sell();
    const sub = (await get(alice, acmeId, '/subscription').expect(200)).body;
    expect(sub.usage.salesThisMonth).toBe(2);
    const overview = (await adminGet('/overview').expect(200)).body;
    expect(
      overview.alerts.find(
        (a: { kind: string; shop: { id: string } | null }) =>
          a.kind === 'quota' && a.shop?.id === acmeId,
      )?.message,
    ).toBe('2 ventes ce mois-ci : au-delà des 1 permis par l’offre.');
    await setPlan(acmePlan).expect(200);
  });

  it('shows only the months of history of the offer, and erases nothing', async () => {
    await sell();
    await sell();
    const all = (
      await get(alice, acmeId, '/sales?all=true&limit=50&offset=0').expect(200)
    ).body as { id: string }[];
    const old = all[0]!.id;
    // A sale is never changed by the application: the test moves it back
    // in time with the triggers off, as a five-month-old sale would be.
    expect(old).toMatch(/^[0-9a-f-]{36}$/);
    await ctx.admin.query(
      `begin;
       set local session_replication_role = replica;
       update app.sales set occurred_at = now() - interval '5 months' where id = '${old}';
       commit;`,
    );
    await setPlan(acmePlan, { historyMonths: 3 }).expect(200);
    const shown = (
      await get(alice, acmeId, '/sales?all=true&limit=50&offset=0').expect(200)
    ).body as { id: string }[];
    expect(shown.map((s) => s.id)).not.toContain(old);
    expect(shown).toHaveLength(all.length - 1);
    // Opened directly, it is still there.
    await get(alice, acmeId, `/sales/${old}`).expect(200);

    const day = (months: number) => {
      const d = new Date();
      d.setUTCMonth(d.getUTCMonth() - months);
      return d.toISOString().slice(0, 10);
    };
    const refused = await get(
      alice,
      acmeId,
      `/stats/summary?from=${day(6)}&to=${day(4)}`,
    ).expect(403);
    expect(refused.body.error.code).toBe('HISTORY_NOT_IN_PLAN');
    const clamped = (
      await get(
        alice,
        acmeId,
        `/stats/summary?from=${day(6)}&to=${day(0)}`,
      ).expect(200)
    ).body;
    expect(clamped.from > day(6)).toBe(true);

    // Without « Rapports », 3 months at most, whatever the history.
    await setPlan(acmePlan, { modules: ['accounting'] }).expect(200);
    const closed = await get(
      alice,
      acmeId,
      `/stats/summary?from=${day(5)}&to=${day(4)}`,
    ).expect(403);
    expect(closed.body.error.code).toBe('MODULE_NOT_IN_PLAN');

    // Another offer: everything shows again.
    await setPlan(acmePlan).expect(200);
    const back = (
      await get(alice, acmeId, '/sales?all=true&limit=50&offset=0').expect(200)
    ).body as { id: string }[];
    expect(back.map((s) => s.id)).toContain(old);
  });
});
