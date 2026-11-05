import { randomUUID } from 'node:crypto';
import {
  waveRefused,
  type WaveClient,
  type WaveSession,
} from '../src/orders/wave.client.js';
import { waveSignature } from '../src/orders/wave-signature.js';
import type { TestContext, TestUser } from './support/app.js';
import { createTestContext } from './support/app.js';

/** Stands in for the Wave Business API: what it was asked, what it says. */
class FakeWave implements WaveClient {
  sessions = new Map<string, WaveSession & { key: string }>();
  calls: { method: string; key: string; signing: string | null }[] = [];
  private next = 1;

  probe: WaveClient['probe'] = (credentials) => {
    this.calls.push({
      method: 'probe',
      key: credentials.apiKey,
      signing: credentials.signingSecret,
    });
    return credentials.apiKey.includes('refused')
      ? Promise.reject(waveRefused(401))
      : Promise.resolve();
  };

  createSession: WaveClient['createSession'] = (credentials, input) => {
    this.calls.push({
      method: 'create',
      key: credentials.apiKey,
      signing: credentials.signingSecret,
    });
    const id = `cos-${String(this.next++).padStart(6, '0')}`;
    const session = {
      id,
      amount: input.amount,
      currency: input.currency,
      checkoutStatus: 'open' as const,
      paymentStatus: null,
      clientReference: input.clientReference,
      transactionId: null,
      launchUrl: `https://pay.wave.com/c/${id}`,
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      key: credentials.apiKey,
      successUrl: input.successUrl,
      errorUrl: input.errorUrl,
    };
    this.sessions.set(id, session);
    return Promise.resolve(session);
  };

  getSession: WaveClient['getSession'] = (credentials, id) => {
    this.calls.push({
      method: 'get',
      key: credentials.apiKey,
      signing: credentials.signingSecret,
    });
    const session = this.sessions.get(id);
    // A key reads its own wallet only.
    if (!session || session.key !== credentials.apiKey)
      return Promise.reject(waveRefused(404));
    return Promise.resolve(session);
  };

  pay(id: string, amount?: string) {
    const session = this.sessions.get(id)!;
    Object.assign(session, {
      checkoutStatus: 'complete',
      paymentStatus: 'succeeded',
      transactionId: `T${id.slice(4)}`,
      ...(amount ? { amount } : {}),
    });
  }
}

describe('Paying an order by Wave', () => {
  const wave = new FakeWave();
  let ctx: TestContext;
  let alice: TestUser; // owner of Acme
  let bob: TestUser; // owner of Globex
  let carol: TestUser; // seller at Acme
  let acmeId: string;
  let acmeSlug: string;
  let globexId: string;
  let globexSlug: string;
  let water: { id: string };
  const API_KEY = 'wave_sn_prod_acme_secret_key_0001';
  const WEBHOOK_SECRET = 'wave_sn_WHS_acme_webhook_secret_01';

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
  const order = async (slug = acmeSlug) =>
    (
      await ctx
        .http()
        .post(`/api/v1/public/shops/${slug}/orders`)
        .send({
          name: 'Awa Diop',
          phone: `77 ${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`,
          area: 'Médina',
          lines: [{ productId: water.id, quantity: 2 }],
          expectedTotal: 1000,
        })
        .expect(201)
    ).body as { id: string; reference: string; wave: boolean };
  const launch = (id: string, slug = acmeSlug) =>
    ctx.http().post(`/api/v1/public/shops/${slug}/orders/${id}/wave`);
  const status = (id: string, slug = acmeSlug) =>
    ctx.http().get(`/api/v1/public/shops/${slug}/orders/${id}`);
  const sessionOf = async (orderId: string) =>
    (
      await ctx.admin.query(
        'select wave_session_id from app.orders where id = $1',
        [orderId],
      )
    ).rows[0].wave_session_id as string;

  beforeAll(async () => {
    ctx = await createTestContext({ wave });
    [alice, bob, carol] = await Promise.all([
      ctx.createUser(),
      ctx.createUser(),
      ctx.createUser(),
    ]);
    const open = async (user: TestUser, name: string) => {
      const shop = (
        await ctx
          .http()
          .post('/api/v1/organizations')
          .set({ Authorization: `Bearer ${user.token}` })
          .send({ name })
          .expect(201)
      ).body as { id: string; slug: string };
      await put(user, shop.id, '/organizations/current/modules', {
        hiddenModules: [],
      }).expect(200);
      await put(user, shop.id, '/orders/settings', {
        published: true,
        waveNumber: '',
        orangeMoneyNumber: '',
        note: '',
      }).expect(200);
      return shop;
    };
    const acme = await open(alice, 'Acme Wave');
    acmeId = acme.id;
    acmeSlug = acme.slug;
    const globex = await open(bob, 'Globex Wave');
    globexId = globex.id;
    globexSlug = globex.slug;
    await ctx.admin.query(
      `insert into app.organization_memberships (organization_id, user_id, role)
       values ($1, $2, 'member')`,
      [acmeId, carol.id],
    );
    water = (
      await post(alice, acmeId, '/products', {
        name: 'Eau 1,5 L',
        categoryId: null,
        unit: 'bouteille',
        salePrice: 500,
        purchasePrice: null,
        taxRateId: null,
        barcode: null,
        lowStockThreshold: null,
        trackStock: true,
        initialStock: 50,
        clientOperationId: randomUUID(),
      }).expect(201)
    ).body;
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('the account of the shop', () => {
    it('starts without Wave, and the receipt offers none', async () => {
      const account = await get(alice, acmeId, '/orders/wave').expect(200);
      expect(account.body).toMatchObject({
        connected: false,
        keyHint: null,
        available: true,
        webhookPath: `/api/v1/public/wave/webhooks/${acmeId}`,
      });
      const receipt = await order();
      expect(receipt.wave).toBe(false);
      const res = await launch(receipt.id).expect(409);
      expect(res.body.error.code).toBe('WAVE_NOT_CONNECTED');
    });

    it('keeps a key only once Wave accepts it', async () => {
      const refused = await put(alice, acmeId, '/orders/wave', {
        apiKey: 'wave_sn_prod_refused_key_000000',
      }).expect(502);
      expect(refused.body.error.code).toBe('WAVE_KEY_REFUSED');
      await put(alice, acmeId, '/orders/wave', {
        apiKey: 'pas une clé',
      }).expect(400);
      const account = await get(alice, acmeId, '/orders/wave').expect(200);
      expect(account.body.connected).toBe(false);
    });

    it('connects the key, and never shows it again', async () => {
      const res = await put(alice, acmeId, '/orders/wave', {
        apiKey: API_KEY,
        signingSecret: '',
        webhookSecret: WEBHOOK_SECRET,
      }).expect(200);
      expect(res.body).toMatchObject({
        connected: true,
        keyHint: '0001',
        signing: false,
        webhook: true,
      });
      const raw = JSON.stringify(
        (await get(alice, acmeId, '/orders/wave').expect(200)).body,
      );
      expect(raw).not.toContain('acme_secret_key');
      expect(raw).not.toContain('acme_webhook_secret');
      // The database holds ciphertext only.
      const stored = await ctx.admin.query(
        'select * from app.organization_wave_accounts where organization_id = $1',
        [acmeId],
      );
      expect(JSON.stringify(stored.rows)).not.toContain('acme_secret_key');
      expect(JSON.stringify(stored.rows)).not.toContain('acme_webhook_secret');
      const audit = await ctx.admin.query(
        `select metadata from app.audit_logs
          where organization_id = $1 and action = 'wave.connected'`,
        [acmeId],
      );
      expect(audit.rows[0].metadata).toEqual({
        keyHint: '0001',
        signing: false,
        webhook: true,
      });
    });

    it('keeps the account to the owner and managers', async () => {
      await get(carol, acmeId, '/orders/wave').expect(403);
      await put(carol, acmeId, '/orders/wave', { apiKey: API_KEY }).expect(403);
      await ctx
        .http()
        .delete('/api/v1/orders/wave')
        .set(as(carol, acmeId))
        .expect(403);
      // Another shop sees its own account, empty.
      const globex = await get(bob, globexId, '/orders/wave').expect(200);
      expect(globex.body.connected).toBe(false);
      await get(bob, acmeId, '/orders/wave').expect(404);
    });
  });

  describe('paying', () => {
    let paid: { id: string; reference: string };

    it('opens one Wave session per order, for its amount, back to the site', async () => {
      paid = await order();
      expect((await order()).wave).toBe(true);
      const first = await launch(paid.id).expect(201);
      expect(first.body.launchUrl).toMatch(
        /^https:\/\/pay\.wave\.com\/c\/cos-/,
      );
      const again = await launch(paid.id).expect(201);
      expect(again.body.launchUrl).toBe(first.body.launchUrl);
      const session = wave.sessions.get(await sessionOf(paid.id))!;
      expect(session).toMatchObject({
        amount: '1000',
        currency: 'XOF',
        clientReference: paid.id,
        key: API_KEY,
      });
      expect((session as unknown as { successUrl: string }).successUrl).toBe(
        `https://nagaw.test/b/${acmeSlug}/paiement/${paid.id}`,
      );
    });

    it('says not paid while Wave says so', async () => {
      const res = await status(paid.id).expect(200);
      expect(res.body).toMatchObject({
        reference: paid.reference,
        paid: false,
        wave: 'open',
        total: 1000,
      });
    });

    it('marks the order paid once Wave says it succeeded, once', async () => {
      wave.pay(await sessionOf(paid.id));
      const res = await status(paid.id).expect(200);
      expect(res.body).toMatchObject({ paid: true, wave: 'succeeded' });
      await status(paid.id).expect(200);
      const shopSide = await get(alice, acmeId, `/orders/${paid.id}`).expect(
        200,
      );
      expect(shopSide.body.payment).toEqual({
        method: 'mobile_money',
        provider: 'wave',
        reference: `T${(await sessionOf(paid.id)).slice(4)}`,
      });
      const audit = await ctx.admin.query(
        `select actor_type from app.audit_logs
          where organization_id = $1 and action = 'order.paid' and target_id = $2`,
        [acmeId, paid.id],
      );
      expect(audit.rows).toEqual([{ actor_type: 'system' }]);
      const closed = await launch(paid.id).expect(409);
      expect(closed.body.error.code).toBe('ORDER_ALREADY_PAID');
    });

    it('never takes a payment of another amount', async () => {
      const other = await order();
      await launch(other.id).expect(201);
      wave.pay(await sessionOf(other.id), '10');
      const res = await status(other.id).expect(200);
      expect(res.body).toMatchObject({ paid: false, wave: 'failed' });
    });

    it('lets the seller ask Wave again', async () => {
      const next = await order();
      await launch(next.id).expect(201);
      wave.pay(await sessionOf(next.id));
      const res = await post(
        carol,
        acmeId,
        `/orders/${next.id}/wave/check`,
      ).expect(201);
      expect(res.body.paidAt).not.toBeNull();
      expect(res.body.waveSessionId).toMatch(/^cos-/);
    });

    it('never opens nor reads an order through another shop', async () => {
      const mine = await order();
      await launch(mine.id, globexSlug).expect(404);
      await status(mine.id, globexSlug).expect(404);
      await launch(randomUUID()).expect(404);
      await status('pas-un-id').expect(404);
      await post(bob, globexId, `/orders/${mine.id}/wave/check`).expect(404);
    });
  });

  describe('optional webhook', () => {
    const hook = (
      orgId: string,
      body: string,
      headers: Record<string, string>,
    ) =>
      ctx
        .http()
        .post(`/api/v1/public/wave/webhooks/${orgId}`)
        .set({ 'Content-Type': 'application/json', ...headers })
        .send(body);

    it('refuses a webhook without the right signature', async () => {
      const body = JSON.stringify({
        id: 'AE_1',
        type: 'test.test_event',
        data: {},
      });
      await hook(acmeId, body, {}).expect(401);
      await hook(acmeId, body, {
        'Wave-Signature': waveSignature(
          'wave_sn_WHS_wrong_secret_000000',
          body,
          Math.floor(Date.now() / 1000),
        ),
      }).expect(401);
      // A shop without webhook secret accepts none.
      await hook(globexId, body, {
        'Wave-Signature': waveSignature(
          WEBHOOK_SECRET,
          body,
          Math.floor(Date.now() / 1000),
        ),
      }).expect(401);
      await hook('pas-un-id', body, {}).expect(401);
    });

    it('looks again at Wave on a signed event, and marks the order paid', async () => {
      const mine = await order();
      await launch(mine.id).expect(201);
      const id = await sessionOf(mine.id);
      wave.pay(id);
      const body = JSON.stringify({
        id: 'AE_ijzo7oGgrlM7',
        type: 'checkout.session.completed',
        data: { id, amount: '1000', checkout_status: 'complete' },
      });
      await hook(acmeId, body, {
        'Wave-Signature': waveSignature(
          WEBHOOK_SECRET,
          body,
          Math.floor(Date.now() / 1000),
        ),
      }).expect(200);
      const res = await get(alice, acmeId, `/orders/${mine.id}`).expect(200);
      expect(res.body.payment.provider).toBe('wave');
    });

    it('accepts the shared secret strategy of the portal', async () => {
      const body = JSON.stringify({
        id: 'AE_2',
        type: 'test.test_event',
        data: {},
      });
      await hook(acmeId, body, {
        Authorization: `Bearer ${WEBHOOK_SECRET}`,
      }).expect(200);
    });
  });

  describe('disconnecting', () => {
    it('forgets the key and stops offering Wave', async () => {
      const res = await ctx
        .http()
        .delete('/api/v1/orders/wave')
        .set(as(alice, acmeId))
        .expect(200);
      expect(res.body).toMatchObject({ connected: false, keyHint: null });
      const receipt = await order();
      expect(receipt.wave).toBe(false);
      await launch(receipt.id).expect(409);
      const stored = await ctx.admin.query(
        'select key_hint, webhook_secret_sealed, disconnected_at from app.organization_wave_accounts where organization_id = $1',
        [acmeId],
      );
      expect(stored.rows[0]).toMatchObject({
        key_hint: '----',
        webhook_secret_sealed: null,
      });
      expect(stored.rows[0].disconnected_at).not.toBeNull();
    });
  });
});
