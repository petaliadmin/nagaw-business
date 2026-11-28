import { randomUUID } from 'node:crypto';
import type { TestContext, TestUser } from './support/app.js';
import { createTestContext } from './support/app.js';

/** The data of a shop, managed by the administration (ADR-074). */
describe('Shop data from the administration', () => {
  let ctx: TestContext;
  let alice: TestUser; // owner of Acme
  let bob: TestUser; // owner of Globex
  let zed: TestUser; // platform administrator
  let acmeId: string;
  let globexId: string;
  let water: { id: string };
  let fatou: { id: string };
  let saleId: string;
  let invoiceId: string;

  const bearer = (user: TestUser) => ({
    Authorization: `Bearer ${user.token}`,
  });
  const shop = (user: TestUser, orgId = acmeId) => ({
    ...bearer(user),
    'X-Organization-Id': orgId,
  });
  const post = (user: TestUser, path: string, body: object, orgId = acmeId) =>
    ctx.http().post(`/api/v1${path}`).set(shop(user, orgId)).send(body);
  const list = (kind: string, query = '', user = zed, orgId = acmeId) =>
    ctx
      .http()
      .get(`/api/v1/admin/shops/${orgId}/data/${kind}${query}`)
      .set(bearer(user));
  const act = (
    kind: string,
    id: string,
    action: string,
    reason = 'Demande du propriétaire',
    user = zed,
    orgId = acmeId,
  ) =>
    ctx
      .http()
      .post(`/api/v1/admin/shops/${orgId}/data/${kind}/${id}/${action}`)
      .set(bearer(user))
      .send({ reason });

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
      await post(alice, '/products', {
        name: 'Eau',
        categoryId: null,
        unit: 'piece',
        salePrice: 500,
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
      await post(alice, '/customers', {
        name: 'Fatou',
        clientOperationId: randomUUID(),
      }).expect(201)
    ).body;
    saleId = (
      await post(alice, '/sales', {
        clientOperationId: randomUUID(),
        lines: [{ productId: water.id, quantity: 2 }],
        payments: [{ method: 'cash', amount: 1000 }],
        expectedTotal: 1000,
      }).expect(201)
    ).body.id;
    const draft = (
      await post(alice, '/invoices', {
        customerId: fatou.id,
        lines: [
          { label: 'Conseil', unit: 'piece', quantity: 1, unitPrice: 2000 },
        ],
        clientOperationId: randomUUID(),
      }).expect(201)
    ).body;
    invoiceId = (
      await post(alice, `/invoices/${draft.id}/issue`, {}).expect(200)
    ).body.id;
  });

  it('opens the data only once the administrator entered with a reason', async () => {
    const closed = await list('products').expect(403);
    expect(closed.body.error.code).toBe('SHOP_ACCESS_REQUIRED');
    for (const orgId of [acmeId, globexId])
      await ctx
        .http()
        .post(`/api/v1/admin/shops/${orgId}/access`)
        .set(bearer(zed))
        .send({ reason: 'Ménage demandé par le propriétaire' })
        .expect(200);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('lists what a shop holds, without its « Vente au montant »', async () => {
    const products = (await list('products').expect(200)).body;
    expect(products).toEqual([
      expect.objectContaining({
        id: water.id,
        label: 'Eau',
        action: 'archive',
      }),
    ]);
    const sales = (await list('sales').expect(200)).body;
    expect(sales).toEqual([
      expect.objectContaining({ id: saleId, action: 'cancel' }),
    ]);
    const invoices = (await list('invoices').expect(200)).body;
    expect(invoices[0]).toMatchObject({ id: invoiceId, action: 'cancel' });
    await list('nothing').expect(400);
  });

  it('archives and restores a product and a customer, as done by the platform', async () => {
    await act('products', water.id, 'archive', '').expect(400); // a reason
    await act('products', water.id, 'archive').expect(204);
    const catalogue = (
      await ctx.http().get('/api/v1/products').set(shop(alice)).expect(200)
    ).body as { id: string }[];
    expect(catalogue.map((p) => p.id)).not.toContain(water.id);
    expect(
      (
        (await list('products', '?closed=true').expect(200)).body as {
          id: string;
        }[]
      ).map((p) => p.id),
    ).toEqual([water.id]);
    await act('products', water.id, 'restore', '').expect(204);
    await act('customers', fatou.id, 'archive').expect(204);
    await act('customers', fatou.id, 'restore', '').expect(204);
    // A product is not cancelled, a sale is not archived.
    await act('products', water.id, 'cancel').expect(409);
    await act('sales', saleId, 'archive').expect(409);

    const history = (
      await ctx
        .http()
        .get('/api/v1/audit-logs?limit=20')
        .set(shop(alice))
        .expect(200)
    ).body.data as { action: string; actorType: string; metadata: object }[];
    expect(history).toContainEqual(
      expect.objectContaining({
        action: 'platform.data_changed',
        actorType: 'platform_admin',
        metadata: expect.objectContaining({
          kind: 'products',
          action: 'archive',
          reason: 'Demande du propriétaire',
        }),
      }),
    );
    expect(history).toContainEqual(
      expect.objectContaining({
        action: 'product.archived',
        actorType: 'platform_admin',
      }),
    );
  });

  it('cancels a sale and an issued invoice with the shop’s own rules', async () => {
    await act('sales', saleId, 'cancel', 'Erreur de caisse').expect(204);
    const sale = (
      await ctx
        .http()
        .get(`/api/v1/sales/${saleId}`)
        .set(shop(alice))
        .expect(200)
    ).body;
    expect(sale).toMatchObject({
      status: 'cancelled',
      cancellation: expect.objectContaining({ reason: 'Erreur de caisse' }),
    });
    // The stock came back.
    const product = (
      await ctx
        .http()
        .get(`/api/v1/products/${water.id}`)
        .set(shop(alice))
        .expect(200)
    ).body;
    expect(product.stockQuantity).toBe(10);
    await act('sales', saleId, 'cancel').expect(409);

    await act('invoices', invoiceId, 'cancel', 'Facture en double').expect(204);
    const invoice = (
      await ctx
        .http()
        .get(`/api/v1/invoices/${invoiceId}`)
        .set(shop(alice))
        .expect(200)
    ).body;
    expect(invoice.status).toBe('cancelled');
  });

  it('is for the administration only, and keeps to the shop named', async () => {
    await list('products', '', alice).expect(403);
    await act('products', water.id, 'archive', 'x', alice).expect(403);
    // The product of Acme is not found in Globex.
    await act('products', water.id, 'archive', 'x', zed, globexId).expect(404);
    expect(
      (await list('products', '', zed, globexId).expect(200)).body,
    ).toEqual([]);
    await list('products', '', zed, 'not-a-uuid').expect(404);
  });
});
