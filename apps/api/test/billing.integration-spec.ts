import { BillingService } from '../src/subscriptions/billing.service.js';
import type { TestContext, TestUser } from './support/app.js';
import { createTestContext } from './support/app.js';

const DAY = 24 * 60 * 60 * 1000;

/** Terms, renewals and invoices of the subscriptions (ADR-073). */
describe('Subscription billing', () => {
  let ctx: TestContext;
  let alice: TestUser; // owner of Acme
  let bob: TestUser; // owner of Globex
  let zed: TestUser; // platform administrator
  let acmeId: string;
  let globexId: string;
  let billing: BillingService;

  const bearer = (user: TestUser) => ({
    Authorization: `Bearer ${user.token}`,
  });
  const shop = (user: TestUser, orgId: string) => ({
    ...bearer(user),
    'X-Organization-Id': orgId,
  });
  const admin = (path: string) =>
    ctx.http().get(`/api/v1/admin${path}`).set(bearer(zed));
  const adminSend = (
    method: 'post' | 'patch',
    path: string,
    body: object = {},
    user = zed,
  ) => ctx.http()[method](`/api/v1/admin${path}`).set(bearer(user)).send(body);
  const subscription = async (user = alice, orgId = acmeId) =>
    (
      await ctx
        .http()
        .get('/api/v1/subscription')
        .set(shop(user, orgId))
        .expect(200)
    ).body;
  const statusOf = async (orgId: string) =>
    (
      await ctx.admin.query(
        'select status from app.organizations where id = $1',
        [orgId],
      )
    ).rows[0].status as string;
  /** Moves the end of the term, as if the days had passed. */
  const endTermAt = (orgId: string, at: Date) =>
    ctx.admin.query(
      'update app.subscriptions set current_period_end = $2 where organization_id = $1',
      [orgId, at],
    );

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
    billing = ctx.app.get(BillingService);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('gives a free offer no term, and a paid offer one month or one year', async () => {
    expect(await subscription()).toMatchObject({
      plan: { key: 'free', yearlyPrice: 0 },
      period: 'month',
      currentPeriodEnd: null,
      autoRenew: true,
      lifetime: false,
      invoices: [],
    });
    // The owner asks for one year; the platform approves, payment received.
    await ctx
      .http()
      .post('/api/v1/subscription/requests')
      .set(shop(alice, acmeId))
      .send({ planKey: 'essential', period: 'year' })
      .expect(201);
    const [request] = (
      (await admin('/plan-requests').expect(200)).body as {
        id: string;
        shop: { id: string };
        period: string;
      }[]
    ).filter((r) => r.shop.id === acmeId);
    expect(request!.period).toBe('year');
    await adminSend('post', `/plan-requests/${request!.id}/approve`, {
      note: 'Wave',
    }).expect(200);
    const sub = await subscription();
    expect(sub).toMatchObject({ plan: { key: 'essential' }, period: 'year' });
    const end = new Date(sub.currentPeriodEnd).getTime();
    expect(end - Date.now()).toBeGreaterThan(364 * DAY);
    expect(sub.invoices).toEqual([
      expect.objectContaining({
        status: 'paid',
        period: 'year',
        amount: sub.plan.yearlyPrice,
      }),
    ]);
    expect(sub.plan.yearlyPrice).toBe(sub.plan.monthlyPrice * 12);
  });

  it('extends a term by hand from its end', async () => {
    const before = new Date((await subscription()).currentPeriodEnd);
    const shopDto = (
      await adminSend('post', `/shops/${acmeId}/renew`, {
        period: 'month',
        note: 'Espèces',
      }).expect(200)
    ).body;
    const after = new Date(shopDto.subscription.currentPeriodEnd);
    expect(after.getTime() - before.getTime()).toBeGreaterThan(27 * DAY);
    expect(shopDto.subscription.invoices[0]).toMatchObject({
      status: 'paid',
      period: 'month',
      note: 'Espèces',
    });
    // The free offer does not renew.
    await adminSend('post', `/shops/${globexId}/renew`, {
      period: 'month',
    }).expect(409);
  });

  it('renews automatically with an invoice, and suspends after the grace if unpaid', async () => {
    await endTermAt(acmeId, new Date(Date.now() - 1000));
    await billing.runDue();
    let sub = await subscription();
    const invoice = sub.invoices[0];
    expect(invoice).toMatchObject({ status: 'pending' });
    // Due after the grace days of the platform (15 by default).
    const due = new Date(invoice.dueAt).getTime() - Date.now();
    expect(due).toBeGreaterThan(14 * DAY);
    expect(due).toBeLessThan(16 * DAY);
    expect(new Date(sub.currentPeriodEnd).getTime()).toBeGreaterThan(
      Date.now(),
    );
    // Run twice the same day: one invoice.
    await billing.runDue();
    expect(
      (await subscription()).invoices.filter(
        (i: { status: string }) => i.status === 'pending',
      ),
    ).toHaveLength(1);
    expect(await statusOf(acmeId)).toBe('active');

    // The grace passes, nobody marked it paid: the shop is suspended.
    await billing.runDue(new Date(Date.now() + 16 * DAY));
    expect(await statusOf(acmeId)).toBe('suspended');
    const overview = (await admin('/overview').expect(200)).body;
    expect(overview.invoices.pending).toBeGreaterThanOrEqual(1);
    const listed = (await admin('/invoices').expect(200)).body as {
      id: string;
      overdue: boolean;
      shop: { id: string };
    }[];
    expect(listed.find((i) => i.id === invoice.id)).toMatchObject({
      shop: { id: acmeId },
    });

    // Marked paid: the shop opens again.
    await adminSend('post', `/invoices/${invoice.id}/paid`, {
      note: 'Wave reçu',
    }).expect(200);
    expect(await statusOf(acmeId)).toBe('active');
    await adminSend('post', `/invoices/${invoice.id}/paid`).expect(409);
    sub = await subscription();
    expect(
      sub.invoices.find((i: { id: string }) => i.id === invoice.id),
    ).toMatchObject({
      status: 'paid',
    });
  });

  it('goes back to the free offer at the end of a term not renewed', async () => {
    // The owner turns the renewal off.
    await ctx
      .http()
      .patch('/api/v1/subscription')
      .set(shop(alice, acmeId))
      .send({ autoRenew: false })
      .expect(200);
    await endTermAt(acmeId, new Date(Date.now() - 1000));
    await billing.runDue();
    expect(await subscription()).toMatchObject({
      plan: { key: 'free' },
      currentPeriodEnd: null,
    });
    expect(await statusOf(acmeId)).toBe('active');
  });

  it('gives a lifetime subscription, by the platform only', async () => {
    await ctx
      .http()
      .patch('/api/v1/subscription')
      .set(shop(bob, globexId))
      .send({ lifetime: true })
      .expect(400); // not a field of the owner
    await adminSend('post', `/shops/${globexId}/plan`, {
      planKey: 'pro',
      period: 'month',
    }).expect(200);
    const lifetime = (
      await adminSend('patch', `/shops/${globexId}/subscription`, {
        lifetime: true,
        note: 'Client fondateur',
      }).expect(200)
    ).body.subscription;
    expect(lifetime).toMatchObject({
      lifetime: true,
      currentPeriodEnd: null,
      autoRenew: false,
    });
    // Never invoiced, never ended.
    await billing.runDue(new Date(Date.now() + 400 * DAY));
    expect(await subscription(bob, globexId)).toMatchObject({
      plan: { key: 'pro' },
      lifetime: true,
    });
    expect(await statusOf(globexId)).toBe('active');
    await adminSend('post', `/shops/${globexId}/renew`, {
      period: 'month',
    }).expect(409);
    // A member of a shop is not the platform.
    await adminSend(
      'patch',
      `/shops/${globexId}/subscription`,
      { lifetime: false },
      bob,
    ).expect(403);
    const history = (
      await ctx
        .http()
        .get('/api/v1/audit-logs?limit=5')
        .set(shop(bob, globexId))
        .expect(200)
    ).body.data as { action: string; actorType: string }[];
    expect(history).toContainEqual(
      expect.objectContaining({
        action: 'subscription.lifetime_granted',
        actorType: 'platform_admin',
      }),
    );
  });

  it('keeps each shop to its own subscription', async () => {
    const invoices = (await subscription(bob, globexId)).invoices as {
      id: string;
    }[];
    const theirs = (await subscription()).invoices as { id: string }[];
    const ids = new Set(theirs.map((i) => i.id));
    expect(invoices.filter((i) => ids.has(i.id))).toEqual([]);
    await ctx
      .http()
      .get('/api/v1/subscription')
      .set(shop(alice, globexId))
      .expect(404);
    await adminSend('post', '/invoices/not-a-uuid/paid').expect(404);
  });
});
