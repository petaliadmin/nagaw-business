import { randomUUID } from 'node:crypto';
import { DailyService } from '../src/notifications/daily.service.js';
import type { TestContext, TestUser } from './support/app.js';
import { createTestContext } from './support/app.js';

interface Notification {
  id: string;
  category: string;
  kind: string;
  severity: string;
  title: string;
  body: string;
  link: string | null;
  occurrences: number;
  read: boolean;
}

describe('Notifications, seller access and stock checks (ADR-036)', () => {
  let ctx: TestContext;
  let alice: TestUser; // owner of Acme
  let bob: TestUser; // owner of Globex
  let carol: TestUser; // seller of Acme
  let dan: TestUser; // admin of Acme
  let erin: TestUser; // reader (accountant) of Acme
  let acmeId: string;
  let globexId: string;
  let device: { id: string; ticketPrefix: string };

  const as = (user: TestUser, orgId: string) => ({
    Authorization: `Bearer ${user.token}`,
    'X-Organization-Id': orgId,
  });
  const get = (user: TestUser, orgId: string, path: string) =>
    ctx.http().get(`/api/v1${path}`).set(as(user, orgId));
  const post = (user: TestUser, orgId: string, path: string, body: object) =>
    ctx.http().post(`/api/v1${path}`).set(as(user, orgId)).send(body);
  const put = (user: TestUser, orgId: string, path: string, body: object) =>
    ctx.http().put(`/api/v1${path}`).set(as(user, orgId)).send(body);
  const patch = (user: TestUser, orgId: string, path: string, body: object) =>
    ctx.http().patch(`/api/v1${path}`).set(as(user, orgId)).send(body);

  const notificationsOf = async (user: TestUser, orgId = acmeId) =>
    (await get(user, orgId, '/notifications').expect(200)).body
      .items as Notification[];
  const kindsOf = async (user: TestUser) =>
    (await notificationsOf(user)).map((n) => n.kind);

  const createProduct = async (
    name: string,
    initialStock: number,
    lowStockThreshold: number | null = null,
  ) =>
    (
      await post(alice, acmeId, '/products', {
        name,
        categoryId: null,
        unit: 'piece',
        salePrice: 1000,
        purchasePrice: 600,
        taxRateId: null,
        barcode: null,
        trackStock: true,
        lowStockThreshold,
        initialStock: initialStock > 0 ? initialStock : null,
        clientOperationId: randomUUID(),
      }).expect(201)
    ).body as { id: string };

  const stockOf = async (productId: string) =>
    (await get(alice, acmeId, `/products/${productId}`).expect(200)).body
      .stockQuantity as number;

  let ticket = 0;
  const sale = (
    productId: string,
    quantity: number,
    payments: object[] = [{ method: 'cash', amount: quantity * 1000 }],
    extra: Record<string, unknown> = {},
  ) => ({
    type: 'sale',
    clientOperationId: randomUUID(),
    data: {
      deviceTicket: `${device.ticketPrefix}-${String(++ticket).padStart(6, '0')}`,
      occurredAt: new Date(Date.now() - 60_000).toISOString(),
      lines: [{ productId, quantity, unitPrice: 1000 }],
      payments,
      ...extra,
    },
  });
  const correction = (
    productId: string,
    quantity: number,
    counted: number,
  ) => ({
    type: 'stock_correction',
    clientOperationId: randomUUID(),
    data: {
      productId,
      quantity,
      countedQuantity: counted,
      reason: 'Recompté en rayon',
      occurredAt: new Date(Date.now() - 60_000).toISOString(),
    },
  });
  const sync = async (operations: object[], user = carol) =>
    (
      await post(user, acmeId, '/sync', {
        deviceId: device.id,
        operations,
      }).expect(200)
    ).body.results as {
      status: string;
      stockReview?: boolean;
      stockQuantity?: number;
      error?: { code: string };
    }[];

  beforeAll(async () => {
    ctx = await createTestContext();
    [alice, bob, carol, dan, erin] = await Promise.all([
      ctx.createUser(),
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
    await ctx.setPlan(acmeId, 'pro');
    await ctx.admin.query(
      `insert into app.organization_memberships (organization_id, user_id, role)
       values ($1, $2, 'member'), ($1, $3, 'admin'), ($1, $4, 'viewer')`,
      [acmeId, carol.id, dan.id, erin.id],
    );
    device = (
      await post(carol, acmeId, '/devices', {
        label: 'Téléphone du comptoir',
        clientOperationId: randomUUID(),
      }).expect(201)
    ).body;
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('stock checks at the counter', () => {
    it('accepts a sale beyond the stock, flags it and tells the managers, not the seller', async () => {
      const rice = await createProduct('Riz 25 kg', 3, 2);
      const [result] = await sync([sale(rice.id, 5)]);
      expect(result).toMatchObject({ status: 'accepted', stockReview: true });
      expect(await stockOf(rice.id)).toBe(-2);

      for (const manager of [alice, dan]) {
        const review = (await notificationsOf(manager)).find(
          (n) => n.kind === 'sale.review',
        );
        expect(review).toMatchObject({
          category: 'controls',
          severity: 'warning',
        });
        expect(review?.body).toContain(
          '5 pièces de Riz 25 kg vendus pour 3 pièces en stock',
        );
      }
      expect(await kindsOf(carol)).not.toContain('sale.review');
      // The reader does not receive the controls.
      expect(await kindsOf(erin)).not.toContain('sale.review');
      // Out of stock: the shelf is empty, everyone who sells is told.
      expect(await kindsOf(carol)).toContain('stock.out');
      expect(await kindsOf(alice)).toContain('stock.out');
    });

    it('tells « bientôt épuisé » once, when the threshold is crossed', async () => {
      const oil = await createProduct('Huile 1 L', 10, 5);
      await sync([sale(oil.id, 5)]);
      await sync([sale(oil.id, 1)]);
      const low = (await notificationsOf(alice)).filter(
        (n) => n.kind === 'stock.low' && n.link?.endsWith(oil.id),
      );
      expect(low).toHaveLength(1);
      expect(low[0]!.body).toContain('Il reste 5 pièces');
    });

    it('lets a seller correct the stock within the shop’s limit, once', async () => {
      const soap = await createProduct('Savon', 2);
      const op = correction(soap.id, 4, 6);
      const [first] = await sync([op]);
      expect(first).toMatchObject({ status: 'accepted', stockQuantity: 6 });
      const [again] = await sync([op]);
      expect(again).toMatchObject({ status: 'duplicate' });
      expect(await stockOf(soap.id)).toBe(6);

      const movements = (
        await get(alice, acmeId, `/products/${soap.id}/movements`).expect(200)
      ).body as { kind: string; quantity: number; reason: string }[];
      expect(movements[0]).toMatchObject({ kind: 'adjustment', quantity: 4 });
      expect(movements[0]!.reason).toContain('Recompté en rayon');

      const told = (await notificationsOf(alice)).find(
        (n) => n.kind === 'stock.corrected',
      );
      expect(told?.body).toContain('Savon : +4 pièces');
      expect(await kindsOf(carol)).not.toContain('stock.corrected');

      const audit = await ctx.admin.query(
        `select actor_id from app.audit_logs
          where organization_id = $1 and action = 'stock.corrected'`,
        [acmeId],
      );
      expect(audit.rows).toEqual([{ actor_id: carol.id }]);
    });

    it('refuses a seller’s correction above the limit, or when the shop forbids it', async () => {
      const soap = await createProduct('Savon noir', 0);
      const [tooLarge] = await sync([correction(soap.id, 50, 50)]);
      expect(tooLarge).toMatchObject({
        status: 'rejected',
        error: { code: 'STOCK_CORRECTION_TOO_LARGE' },
      });
      // A manager is not limited.
      await patch(alice, acmeId, '/notifications/settings', {
        sellerStockCorrectionMax: 0,
      }).expect(200);
      const [forbidden] = await sync([correction(soap.id, 1, 1)]);
      expect(forbidden).toMatchObject({
        status: 'rejected',
        error: { code: 'STOCK_CORRECTION_NOT_ALLOWED' },
      });
      await patch(alice, acmeId, '/notifications/settings', {
        sellerStockCorrectionMax: 20,
      }).expect(200);
      expect(await stockOf(soap.id)).toBe(0);
      // Refusals reach the managers too.
      const refused = (await notificationsOf(alice)).find(
        (n) => n.kind === 'sync.rejected',
      );
      expect(refused).toMatchObject({ severity: 'danger', occurrences: 2 });
    });

    it('lets a seller record a delivery, and tells the managers', async () => {
      const milk = await createProduct('Lait', 0);
      await post(carol, acmeId, `/products/${milk.id}/movements`, {
        kind: 'purchase',
        quantity: 12,
        clientOperationId: randomUUID(),
      }).expect(201);
      expect(await stockOf(milk.id)).toBe(12);
      const received = (await notificationsOf(alice)).find(
        (n) => n.kind === 'stock.received',
      );
      expect(received?.body).toContain('Lait : +12 pièces');
    });
  });

  describe('grouping and reading', () => {
    it('groups the day’s sales in one notification for the owner', async () => {
      const bread = await createProduct('Pain', 100);
      const before = (await notificationsOf(alice)).find(
        (n) => n.kind === 'activity.sales',
      );
      await sync([sale(bread.id, 1), sale(bread.id, 2)]);
      const sales = (await notificationsOf(alice)).filter(
        (n) => n.kind === 'activity.sales',
      );
      expect(sales).toHaveLength(1);
      expect(sales[0]!.occurrences).toBe((before?.occurrences ?? 0) + 2);
      expect(sales[0]!.title).toMatch(/ventes aujourd’hui/);
      // Only the owner receives the activity by default.
      expect(await kindsOf(dan)).not.toContain('activity.sales');
    });

    it('marks only the person’s own notifications as read', async () => {
      const mine = await notificationsOf(dan);
      const { unread } = (
        await post(dan, acmeId, '/notifications/read', {
          ids: [mine[0]!.id],
        }).expect(200)
      ).body;
      expect(unread).toBe(mine.filter((n) => !n.read).length - 1);
      // Someone else's notification id changes nothing.
      const alices = await notificationsOf(alice);
      await post(dan, acmeId, '/notifications/read', {
        ids: [alices[0]!.id],
      }).expect(200);
      expect((await notificationsOf(alice))[0]!.read).toBe(false);
      await post(alice, acmeId, '/notifications/read', {}).expect(200);
      expect(
        (await get(alice, acmeId, '/notifications/unread-count').expect(200))
          .body.unread,
      ).toBe(0);
    });

    it('starts a new notification once the group was read', async () => {
      const bread = await createProduct('Pain de mie', 100);
      await sync([sale(bread.id, 1)]);
      const sales = (await notificationsOf(alice)).filter(
        (n) => n.kind === 'activity.sales',
      );
      expect(sales).toHaveLength(2);
      expect(sales[0]).toMatchObject({ read: false, occurrences: 1 });
    });
  });

  describe('preferences and settings', () => {
    it('follows each person’s choice, within their rights', async () => {
      const prefs = (
        await get(carol, acmeId, '/notifications/preferences').expect(200)
      ).body as { category: string; enabled: boolean }[];
      expect(prefs.map((p) => p.category)).toEqual(['stock']);
      await put(carol, acmeId, '/notifications/preferences', {
        preferences: [{ category: 'controls', enabled: true, push: true }],
      }).expect(400);

      await put(alice, acmeId, '/notifications/preferences', {
        preferences: [{ category: 'activity', enabled: false, push: false }],
      }).expect(200);
      await post(alice, acmeId, '/notifications/read', {}).expect(200);
      const bread = await createProduct('Baguette', 100);
      await sync([sale(bread.id, 1)]);
      expect(
        (await notificationsOf(alice)).filter(
          (n) => n.kind === 'activity.sales' && !n.read,
        ),
      ).toEqual([]);
      await put(alice, acmeId, '/notifications/preferences', {
        preferences: [{ category: 'activity', enabled: true, push: true }],
      }).expect(200);
    });

    it('lets everyone read the thresholds and only managers change them', async () => {
      expect(
        (await get(carol, acmeId, '/notifications/settings').expect(200)).body,
      ).toMatchObject({ sellerStockCorrectionMax: 20, dailySummaryHour: 20 });
      await patch(carol, acmeId, '/notifications/settings', {
        dailySummaryHour: 8,
      }).expect(403);
      await patch(alice, acmeId, '/notifications/settings', {
        dailySummaryHour: 30,
      }).expect(400);
      const audit = await ctx.admin.query(
        `select count(*)::int as n from app.audit_logs
          where organization_id = $1 and action = 'notification_settings.updated'`,
        [acmeId],
      );
      expect(audit.rows[0].n).toBeGreaterThan(0);
    });
  });

  describe('the seller’s own figures', () => {
    it('shows only the caller’s sales', async () => {
      const mine = (await get(carol, acmeId, '/sales/my-stats').expect(200))
        .body;
      expect(mine.days).toHaveLength(7);
      expect(mine.today.count).toBeGreaterThan(0);
      expect(mine.topProducts.length).toBeGreaterThan(0);
      // The owner sold nothing herself.
      const owner = (await get(alice, acmeId, '/sales/my-stats').expect(200))
        .body;
      expect(owner.week.count).toBe(0);
    });
  });

  describe('daily notifications', () => {
    it('prepares the summary, the forecast and the overdue credits once', async () => {
      const customer = (
        await post(carol, acmeId, '/customers', {
          name: 'Awa Diop',
          phone: '',
          creditLimit: null,
          clientOperationId: randomUUID(),
        }).expect(201)
      ).body;
      const flour = await createProduct('Farine', 4);
      // Sold on credit three days ago, nothing paid back since.
      const [credit] = await sync([
        sale(flour.id, 2, [{ method: 'credit', amount: 2000 }], {
          customerId: customer.id,
          occurredAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
        }),
      ]);
      expect(credit!.status).toBe('accepted');
      await patch(alice, acmeId, '/notifications/settings', {
        dailySummaryHour: 0,
        creditOverdueDays: 2,
        stockForecastDays: 30,
      }).expect(200);
      await ctx.admin.query(
        'update app.organizations set daily_run_on = null where id = $1',
        [acmeId],
      );

      await get(alice, acmeId, '/notifications').expect(200);
      await get(dan, acmeId, '/notifications').expect(200);
      const kinds = await kindsOf(alice);
      expect(kinds.filter((k) => k === 'summary.daily')).toHaveLength(1);
      expect(kinds).toContain('stock.forecast');
      const overdue = (await notificationsOf(alice)).find(
        (n) => n.kind === 'credit.overdue',
      );
      expect(overdue?.title).toContain('Awa Diop');
      const summary = (await notificationsOf(alice)).find(
        (n) => n.kind === 'summary.daily',
      );
      expect(summary?.body).toMatch(/vente/);
      // The admin does not get the summary by default; the reader neither.
      expect(await kindsOf(dan)).not.toContain('summary.daily');

      // Prepared once: the scheduled run finds nothing left to do here.
      await ctx.app.get(DailyService).runDue();
      expect(
        (await kindsOf(alice)).filter((k) => k === 'summary.daily'),
      ).toHaveLength(1);
    });

    it('keeps the scheduled run behind its secret', async () => {
      // No CRON_SECRET in the test environment: the route does nothing.
      await ctx.http().get('/api/v1/cron/daily').expect(503);
      await ctx
        .http()
        .get('/api/v1/cron/daily')
        .set({ Authorization: 'Bearer not-the-secret-at-all' })
        .expect(503);
    });
  });

  describe('push subscriptions', () => {
    const subscription = {
      endpoint: 'https://push.example.test/send/abc',
      keys: { p256dh: 'BKey', auth: 'secret' },
      label: 'Téléphone',
    };

    it('says when push messages are not configured, and keeps notifications in the app', async () => {
      expect(
        (
          await ctx
            .http()
            .get('/api/v1/push/config')
            .set({ Authorization: `Bearer ${alice.token}` })
            .expect(200)
        ).body,
      ).toEqual({ publicKey: null });
      const pushed = await ctx.admin.query(
        `select count(*)::int as n from app.notifications where push_status <> 'none'`,
      );
      expect(pushed.rows[0].n).toBe(0);
    });

    it('gives a browser to the last person who registered it', async () => {
      const register = (user: TestUser) =>
        ctx
          .http()
          .post('/api/v1/push/subscriptions')
          .set({ Authorization: `Bearer ${user.token}` })
          .send(subscription)
          .expect(200);
      await register(alice);
      await register(bob);
      const owner = await ctx.admin.query(
        'select user_id, disabled_at from app.push_subscriptions where endpoint = $1',
        [subscription.endpoint],
      );
      expect(owner.rows).toEqual([{ user_id: bob.id, disabled_at: null }]);
      // Alice cannot switch off Bob's browser.
      await ctx
        .http()
        .post('/api/v1/push/subscriptions/remove')
        .set({ Authorization: `Bearer ${alice.token}` })
        .send({ endpoint: subscription.endpoint })
        .expect(200);
      expect(
        (
          await ctx.admin.query(
            'select disabled_at from app.push_subscriptions where endpoint = $1',
            [subscription.endpoint],
          )
        ).rows[0].disabled_at,
      ).toBeNull();
      await ctx
        .http()
        .post('/api/v1/push/subscriptions')
        .set({ Authorization: `Bearer ${alice.token}` })
        .send({ ...subscription, endpoint: 'http://insecure.example.test/x' })
        .expect(400);
    });
  });

  describe('isolation between shops', () => {
    it('never shows a shop’s notifications in another shop', async () => {
      expect(await notificationsOf(bob, globexId)).toEqual([]);
      const acme = await notificationsOf(alice);
      // Bob marking Acme's ids from his own shop changes nothing.
      await post(bob, globexId, '/notifications/read', {
        ids: acme.slice(0, 3).map((n) => n.id),
      }).expect(200);
      const unread = await ctx.admin.query(
        `select count(*)::int as n from app.notifications
          where organization_id = $1 and id = any($2) and read_at is not null`,
        [
          acmeId,
          acme
            .slice(0, 3)
            .filter((n) => !n.read)
            .map((n) => n.id),
        ],
      );
      expect(unread.rows[0].n).toBe(0);
      // A stranger to Acme gets 404 with Acme's header.
      await get(bob, acmeId, '/notifications').expect(404);
      await patch(bob, acmeId, '/notifications/settings', {
        dailySummaryHour: 1,
      }).expect(404);
      // Globex's thresholds are its own.
      expect(
        (await get(bob, globexId, '/notifications/settings').expect(200)).body
          .dailySummaryHour,
      ).toBe(20);
    });

    it('keeps the database guard on what a notification is about', async () => {
      const [row] = (
        await ctx.admin.query(
          'select id from app.notifications where organization_id = $1 limit 1',
          [acmeId],
        )
      ).rows;
      await expect(
        ctx.admin.query(
          'update app.notifications set organization_id = $2 where id = $1',
          [row.id, globexId],
        ),
      ).rejects.toThrow(/only the text and the state/);
      await expect(
        ctx.admin.query('delete from app.notifications where id = $1', [
          row.id,
        ]),
      ).rejects.toThrow(/never deleted/);
    });
  });
});
