import { randomUUID } from 'node:crypto';
import { vi } from 'vitest';
import { CustomersService } from '../src/sales/customers.service.js';
import { SalesService } from '../src/sales/sales.service.js';
import type { TestContext, TestUser } from './support/app.js';
import { createTestContext } from './support/app.js';

describe('Offline devices and synchronization', () => {
  let ctx: TestContext;
  let alice: TestUser; // owner of Acme
  let bob: TestUser; // owner of Globex
  let carol: TestUser; // seller of Acme
  let acmeId: string;
  let globexId: string;
  let water: { id: string }; // 500 F, stock 20
  let carolDevice: { id: string; ticketPrefix: string };

  const as = (user: TestUser, orgId: string) => ({
    Authorization: `Bearer ${user.token}`,
    'X-Organization-Id': orgId,
  });
  const get = (user: TestUser, orgId: string, path: string) =>
    ctx.http().get(`/api/v1${path}`).set(as(user, orgId));
  const post = (user: TestUser, orgId: string, path: string, body: object) =>
    ctx.http().post(`/api/v1${path}`).set(as(user, orgId)).send(body);

  let ticket = 0;
  const offlineSale = (overrides: Record<string, unknown> = {}) => ({
    type: 'sale',
    clientOperationId: randomUUID(),
    data: {
      deviceTicket: `${carolDevice.ticketPrefix}-${String(++ticket).padStart(6, '0')}`,
      occurredAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      lines: [{ productId: water.id, quantity: 2, unitPrice: 500 }],
      payments: [{ method: 'cash', amount: 1000 }],
      ...overrides,
    },
  });
  const sync = (
    operations: object[],
    user = carol,
    deviceId = carolDevice.id,
  ) => post(user, acmeId, '/sync', { deviceId, operations });
  const stockOf = async (productId: string) =>
    (await get(alice, acmeId, `/products/${productId}`).expect(200)).body
      .stockQuantity as number;

  beforeAll(async () => {
    ctx = await createTestContext();
    [alice, bob, carol] = await Promise.all([
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
    // Several selling devices: more than the free offer allows.
    await ctx.setPlan(acmeId, 'pro');
    await ctx.setPlan(globexId, 'pro');
    await ctx.admin.query(
      `insert into app.organization_memberships (organization_id, user_id, role)
       values ($1, $2, 'member')`,
      [acmeId, carol.id],
    );
    water = (
      await post(alice, acmeId, '/products', {
        name: 'Eau',
        categoryId: null,
        unit: 'bouteille',
        salePrice: 500,
        purchasePrice: null,
        taxRateId: null,
        barcode: null,
        trackStock: true,
        lowStockThreshold: null,
        initialStock: 20,
        clientOperationId: randomUUID(),
      }).expect(201)
    ).body;
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('registers devices with their own ticket prefix, once per operation id', async () => {
    const body = {
      label: 'Téléphone du comptoir',
      clientOperationId: randomUUID(),
    };
    const first = await post(carol, acmeId, '/devices', body).expect(201);
    expect(first.body).toMatchObject({
      ticketPrefix: 'A',
      user: { userId: carol.id },
    });
    const again = await post(carol, acmeId, '/devices', body).expect(200);
    expect(again.body.id).toBe(first.body.id);
    const second = await post(carol, acmeId, '/devices', {
      label: 'Tablette',
      clientOperationId: randomUUID(),
    }).expect(201);
    expect(second.body.ticketPrefix).toBe('B');
    carolDevice = second.body;
    // Sellers see their devices, managers all of them.
    expect(
      (await get(carol, acmeId, '/devices').expect(200)).body,
    ).toHaveLength(2);
    expect(
      (await get(alice, acmeId, '/devices').expect(200)).body,
    ).toHaveLength(2);
    expect((await get(bob, globexId, '/devices').expect(200)).body).toEqual([]);
  });

  it('accepts offline sales once, numbers them and takes the goods out of stock', async () => {
    const before = await stockOf(water.id);
    const operation = offlineSale();
    const res = await sync([operation]).expect(200);
    expect(res.body.results).toEqual([
      expect.objectContaining({
        clientOperationId: operation.clientOperationId,
        status: 'accepted',
        saleNumber: 1,
        priceReview: false,
      }),
    ]);
    const again = await sync([operation]).expect(200);
    expect(again.body.results[0]).toMatchObject({
      status: 'duplicate',
      saleId: res.body.results[0].saleId,
    });
    expect(await stockOf(water.id)).toBe(before - 2);

    const sale = (
      await get(alice, acmeId, `/sales/${res.body.results[0].saleId}`).expect(
        200,
      )
    ).body;
    expect(sale).toMatchObject({
      deviceTicket: operation.data.deviceTicket,
      occurredAt: operation.data.occurredAt,
      seller: { userId: carol.id },
    });
  });

  it('keeps the price the customer paid and flags it when the catalogue differs', async () => {
    const res = await sync([
      offlineSale({
        lines: [{ productId: water.id, quantity: 1, unitPrice: 450 }],
        payments: [{ method: 'cash', amount: 450 }],
      }),
    ]).expect(200);
    expect(res.body.results[0]).toMatchObject({
      status: 'accepted',
      priceReview: true,
    });
    const sale = (
      await get(alice, acmeId, `/sales/${res.body.results[0].saleId}`).expect(
        200,
      )
    ).body;
    expect(sale).toMatchObject({ total: 450, priceReview: true });
    const listed = (
      await get(
        alice,
        acmeId,
        `/sales?day=${sale.occurredAt.slice(0, 10)}`,
      ).expect(200)
    ).body;
    expect(
      listed.find((s: { id: string }) => s.id === sale.id).priceReview,
    ).toBe(true);
  });

  it('refuses one operation with its reason without blocking the others', async () => {
    const bad = offlineSale({
      lines: [{ productId: randomUUID(), quantity: 1, unitPrice: 100 }],
      payments: [{ method: 'cash', amount: 100 }],
    });
    const unpaid = offlineSale({ payments: [{ method: 'cash', amount: 1 }] });
    const old = offlineSale({
      occurredAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    });
    const future = offlineSale({
      occurredAt: new Date(Date.now() + 86400000).toISOString(),
    });
    const good = offlineSale();
    const res = await sync([bad, unpaid, old, future, good]).expect(200);
    expect(res.body.results.map((r: { status: string }) => r.status)).toEqual([
      'rejected',
      'rejected',
      'rejected',
      'rejected',
      'accepted',
    ]);
    expect(res.body.results[0].error).toMatchObject({
      code: 'VALIDATION_FAILED',
    });
    expect(res.body.results[0].error.message).toContain('Produit inconnu');
    expect(res.body.results[2].error.message).toContain('plus de 7 jours');
    expect(res.body.results[3].error.message).toContain('futur');
  });

  it('creates a customer offline and sells to it on credit in the same batch', async () => {
    const customerOp = randomUUID();
    const res = await sync([
      {
        type: 'customer',
        clientOperationId: customerOp,
        data: { name: 'Mariama Ba', phone: '76 000 11 22' },
      },
      offlineSale({
        customerOperationId: customerOp,
        payments: [{ method: 'credit', amount: 1000 }],
      }),
    ]).expect(200);
    expect(res.body.results.map((r: { status: string }) => r.status)).toEqual([
      'accepted',
      'accepted',
    ]);
    const customer = (
      await get(
        alice,
        acmeId,
        `/customers/${res.body.results[0].customerId}`,
      ).expect(200)
    ).body;
    expect(customer).toMatchObject({ name: 'Mariama Ba', balance: 1000 });
  });

  it('still applies seller rules to offline sales', async () => {
    const limit = (maxDiscountBasisPoints: number | null) =>
      ctx
        .http()
        .patch(`/api/v1/organizations/current/members/${carol.id}`)
        .set({
          Authorization: `Bearer ${alice.token}`,
          'X-Organization-Id': acmeId,
        })
        .send({ maxDiscountBasisPoints })
        .expect(200);
    await limit(1000);
    const res = await sync([
      offlineSale({
        discount: 500,
        payments: [{ method: 'cash', amount: 500 }],
      }),
    ]).expect(200);
    expect(res.body.results[0]).toMatchObject({
      status: 'rejected',
      error: { code: 'DISCOUNT_NOT_ALLOWED' },
    });
    await limit(null);
  });

  it('lets any member deliver what the device keeps, and keeps the seller (ADR-053)', async () => {
    // Carol sold on this phone; Alice opens it and delivers.
    const res = await sync(
      [offlineSale({ recordedBy: carol.id })],
      alice,
    ).expect(200);
    expect(res.body.results[0].status).toBe('accepted');
    const sale = (
      await get(alice, acmeId, `/sales/${res.body.results[0].saleId}`).expect(
        200,
      )
    ).body;
    expect(sale.seller.userId).toBe(carol.id);
    // She sees it among her own sales.
    await get(carol, acmeId, `/sales/${sale.id}`).expect(200);
    const { rows } = await ctx.admin.query(
      `select actor_id, metadata from app.audit_logs
        where organization_id = $1 and target_id = $2 and action = 'sale.completed'`,
      [acmeId, sale.id],
    );
    expect(rows[0]).toMatchObject({
      actor_id: alice.id,
      metadata: { soldBy: carol.id },
    });
  });

  it('ignores a seller this device has never seen', async () => {
    const res = await sync([offlineSale({ recordedBy: bob.id })]).expect(200);
    const sale = (
      await get(alice, acmeId, `/sales/${res.body.results[0].saleId}`).expect(
        200,
      )
    ).body;
    expect(sale.seller.userId).toBe(carol.id);
  });

  it('never gives the rights of the named seller to the person who delivers', async () => {
    await ctx
      .http()
      .patch(`/api/v1/organizations/current/members/${carol.id}`)
      .set(as(alice, acmeId))
      .send({ maxDiscountBasisPoints: 1000 })
      .expect(200);
    // Alice was seen on this device, and has no limit; Carol has one.
    const res = await sync([
      offlineSale({
        recordedBy: alice.id,
        discount: 500,
        payments: [{ method: 'cash', amount: 500 }],
      }),
    ]).expect(200);
    expect(res.body.results[0]).toMatchObject({
      status: 'rejected',
      error: { code: 'DISCOUNT_NOT_ALLOWED' },
    });
    await ctx
      .http()
      .patch(`/api/v1/organizations/current/members/${carol.id}`)
      .set(as(alice, acmeId))
      .send({ maxDiscountBasisPoints: null })
      .expect(200);
  });

  it('lets a manager deliver a sale older than the limit, not a seller', async () => {
    const old = () =>
      offlineSale({
        occurredAt: new Date(Date.now() - 30 * 86_400_000).toISOString(),
      });
    const refused = await sync([old()]).expect(200);
    expect(refused.body.results[0].status).toBe('rejected');
    const delivered = await sync([old()], alice).expect(200);
    expect(delivered.body.results[0].status).toBe('accepted');
  });

  it('defers an operation it cannot treat, and the others go on', async () => {
    const sales = ctx.app.get(SalesService);
    const original = sales.create.bind(sales);
    const failing = vi
      .spyOn(sales, 'create')
      .mockImplementationOnce(() => Promise.reject(new Error('panne simulée')))
      .mockImplementation(original);
    const broken = offlineSale();
    const next = offlineSale();
    const res = await sync([broken, next]).expect(200);
    failing.mockRestore();
    expect(res.body.results.map((r: { status: string }) => r.status)).toEqual([
      'deferred',
      'accepted',
    ]);
    // Nothing was refused: it is sent again and recorded.
    const again = await sync([broken]).expect(200);
    expect(again.body.results[0].status).toBe('accepted');
  });

  it('keeps a sale behind the customer it waits for', async () => {
    const customers = ctx.app.get(CustomersService);
    const failing = vi
      .spyOn(customers, 'createAlone')
      .mockRejectedValueOnce(new Error('panne simulée'));
    const customer = {
      type: 'customer',
      clientOperationId: randomUUID(),
      data: {
        name: 'Awa',
        phone: '',
        email: '',
        address: '',
        taxId: '',
        notes: '',
        creditLimit: null,
      },
    };
    const sale = offlineSale({
      customerOperationId: customer.clientOperationId,
      payments: [{ method: 'credit', amount: 1000 }],
    });
    const res = await sync([customer, sale]).expect(200);
    failing.mockRestore();
    expect(res.body.results.map((r: { status: string }) => r.status)).toEqual([
      'deferred',
      'deferred',
    ]);
    const again = await sync([customer, sale]).expect(200);
    expect(again.body.results.map((r: { status: string }) => r.status)).toEqual(
      ['accepted', 'accepted'],
    );
  });

  it('tells which sales it does not hold, in this shop only', async () => {
    const sale = offlineSale();
    await sync([sale]).expect(200);
    const lost = randomUUID();
    const res = await post(carol, acmeId, '/sync/check', {
      deviceId: carolDevice.id,
      clientOperationIds: [sale.clientOperationId, lost],
    }).expect(200);
    expect(res.body.unknown).toEqual([lost]);

    // Another shop learns nothing: its device is unknown here, and its own
    // view of the same sale is « unknown ».
    await post(bob, globexId, '/sync/check', {
      deviceId: carolDevice.id,
      clientOperationIds: [sale.clientOperationId],
    }).expect(404);
    const globexDevice = (
      await post(bob, globexId, '/devices', {
        label: 'Globex vérification',
        clientOperationId: randomUUID(),
      }).expect(201)
    ).body;
    const elsewhere = await post(bob, globexId, '/sync/check', {
      deviceId: globexDevice.id,
      clientOperationIds: [sale.clientOperationId],
    }).expect(200);
    expect(elsewhere.body.unknown).toEqual([sale.clientOperationId]);
  });

  it('only accepts a device of this shop, not revoked', async () => {
    // A device id from nowhere, or from another shop.
    await sync([offlineSale()], carol, randomUUID()).expect(404);
    const globexDevice = (
      await post(bob, globexId, '/devices', {
        label: 'Globex',
        clientOperationId: randomUUID(),
      }).expect(201)
    ).body;
    await post(carol, acmeId, '/sync', {
      deviceId: globexDevice.id,
      operations: [offlineSale()],
    }).expect(404);
    await post(bob, globexId, `/devices/${carolDevice.id}/revoke`, {}).expect(
      404,
    );

    // Revocation is for managers; then the device is refused.
    await post(carol, acmeId, `/devices/${carolDevice.id}/revoke`, {}).expect(
      403,
    );
    const revoked = await post(
      alice,
      acmeId,
      `/devices/${carolDevice.id}/revoke`,
      {},
    ).expect(200);
    expect(revoked.body.revokedAt).not.toBeNull();
    const res = await sync([offlineSale()]).expect(403);
    expect(res.body.error.code).toBe('DEVICE_REVOKED');
  });

  it('keeps a revoked device revoked until a manager restores it', async () => {
    const body = { label: 'Téléphone volé', clientOperationId: randomUUID() };
    const device = (await post(carol, acmeId, '/devices', body).expect(201))
      .body;
    await post(alice, acmeId, `/devices/${device.id}/revoke`, {}).expect(200);

    // The same phone asks again: it stays revoked, whoever asks.
    const again = await post(carol, acmeId, '/devices', body).expect(200);
    expect(again.body.id).toBe(device.id);
    expect(again.body.revokedAt).not.toBeNull();

    // Only a manager of this shop brings it back.
    await post(carol, acmeId, `/devices/${device.id}/restore`, {}).expect(403);
    await post(bob, globexId, `/devices/${device.id}/restore`, {}).expect(404);
    const restored = await post(
      alice,
      acmeId,
      `/devices/${device.id}/restore`,
      {},
    ).expect(200);
    expect(restored.body.revokedAt).toBeNull();
    const res = await post(carol, acmeId, '/sync', {
      deviceId: device.id,
      operations: [
        offlineSale({
          deviceTicket: `${device.ticketPrefix}-000001`,
        }),
      ],
    }).expect(200);
    expect(res.body.results[0].status).toBe('accepted');

    const { rows } = await ctx.admin.query(
      `select actor_id from app.audit_logs where action = 'device.restored' and target_id = $1`,
      [device.id],
    );
    expect(rows).toEqual([{ actor_id: alice.id }]);
  });

  it('audits device sales with their ticket', async () => {
    const { rows } = await ctx.admin.query(
      `select metadata from app.audit_logs where organization_id = $1 and action = 'sale.completed'`,
      [acmeId],
    );
    expect(
      rows.every(
        (r) =>
          r.metadata.offline === true &&
          /^[A-Z]-\d{6}$/.test(r.metadata.deviceTicket),
      ),
    ).toBe(true);
  });
});
