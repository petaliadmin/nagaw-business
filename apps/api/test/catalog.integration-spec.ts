import { randomUUID } from 'node:crypto';
import type { TestContext, TestUser } from './support/app.js';
import { createTestContext } from './support/app.js';

/** Smallest byte sequence recognised as a WebP image (RIFF….WEBP). */
const WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x1a, 0, 0, 0]),
  Buffer.from('WEBPVP8 '),
  Buffer.alloc(14, 1),
]);

describe('Catalogue and stock', () => {
  let ctx: TestContext;
  let alice: TestUser; // owner of Acme
  let bob: TestUser; // owner of Globex
  let carol: TestUser; // seller (member) of Acme
  let acmeId: string;
  let globexId: string;

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

  const product = (overrides: Record<string, unknown> = {}) => ({
    name: `Produit ${randomUUID().slice(0, 8)}`,
    categoryId: null,
    unit: 'piece',
    salePrice: 1000,
    purchasePrice: 700,
    taxRateId: null,
    barcode: null,
    trackStock: true,
    lowStockThreshold: null,
    clientOperationId: randomUUID(),
    ...overrides,
  });
  const createProduct = async (
    overrides: Record<string, unknown> = {},
    user = alice,
    orgId = acmeId,
  ) =>
    (await post(user, orgId, '/products', product(overrides)).expect(201)).body;
  const move = (
    productId: string,
    body: object,
    user = alice,
    orgId = acmeId,
  ) =>
    post(user, orgId, `/products/${productId}/movements`, {
      clientOperationId: randomUUID(),
      ...body,
    });

  async function movementCount(productId: string): Promise<number> {
    const { rows } = await ctx.admin.query<{ count: string }>(
      'select count(*) from app.stock_movements where product_id = $1',
      [productId],
    );
    return Number(rows[0]!.count);
  }

  beforeAll(async () => {
    ctx = await createTestContext();
    [alice, bob, carol] = await Promise.all([
      ctx.createUser(),
      ctx.createUser(),
      ctx.createUser(),
    ]);
    acmeId = (
      await ctx
        .http()
        .post('/api/v1/organizations')
        .set({ Authorization: `Bearer ${alice.token}` })
        .send({ name: 'Acme Dakar' })
        .expect(201)
    ).body.id;
    globexId = (
      await ctx
        .http()
        .post('/api/v1/organizations')
        .set({ Authorization: `Bearer ${bob.token}` })
        .send({ name: 'Globex' })
        .expect(201)
    ).body.id;
    // Many products: more than the free offer allows (ADR-033).
    await ctx.setPlan(acmeId, 'pro');
    await ctx.setPlan(globexId, 'pro');
    await ctx.admin.query(
      `insert into app.organization_memberships (organization_id, user_id, role)
       values ($1, $2, 'member')`,
      [acmeId, carol.id],
    );
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('reference lists', () => {
    it('creates, lists and updates tax rates, categories and suppliers', async () => {
      const tax = await post(alice, acmeId, '/tax-rates', {
        name: 'TVA',
        rateBasisPoints: 1800,
      }).expect(201);
      expect(tax.body).toMatchObject({
        name: 'TVA',
        rateBasisPoints: 1800,
        status: 'active',
      });

      const category = await post(alice, acmeId, '/product-categories', {
        name: 'Boissons',
        color: 'stock',
      }).expect(201);
      expect(category.body).toMatchObject({
        name: 'Boissons',
        color: 'stock',
        productCount: 0,
      });

      const supplier = await post(alice, acmeId, '/suppliers', {
        name: 'Grossiste Sandaga',
        phone: '77 000 00 00',
      }).expect(201);
      expect(supplier.body).toMatchObject({
        name: 'Grossiste Sandaga',
        notes: '',
      });

      const renamed = await patch(
        alice,
        acmeId,
        `/product-categories/${category.body.id}`,
        {
          name: 'Boissons fraîches',
        },
      ).expect(200);
      expect(renamed.body.name).toBe('Boissons fraîches');

      const { rows } = await ctx.admin.query(
        `select action, metadata from app.audit_logs
         where organization_id = $1 and target_id = $2 order by id`,
        [acmeId, category.body.id],
      );
      expect(rows.map((r) => r.action)).toEqual([
        'category.created',
        'category.updated',
      ]);
      expect(rows[1].metadata).toEqual({
        changes: { name: { from: 'Boissons', to: 'Boissons fraîches' } },
      });
    });

    it('refuses a duplicate active name, case-insensitively', async () => {
      await post(alice, acmeId, '/suppliers', {
        name: 'Fournisseur Un',
      }).expect(201);
      const res = await post(alice, acmeId, '/suppliers', {
        name: 'fournisseur un',
      }).expect(409);
      expect(res.body.error.code).toBe('NAME_TAKEN');
    });

    it('applies the cap configured for the shop', async () => {
      await ctx.admin.query(
        'update app.organizations set max_tax_rates = 1 where id = $1',
        [acmeId],
      );
      const res = await post(alice, acmeId, '/tax-rates', {
        name: 'Taxe réduite',
        rateBasisPoints: 1000,
      }).expect(409);
      expect(res.body.error.code).toBe('CATALOG_LIMIT_REACHED');
      await ctx.admin.query(
        'update app.organizations set max_tax_rates = 20 where id = $1',
        [acmeId],
      );
    });

    it('lets sellers read but not change the lists', async () => {
      await get(carol, acmeId, '/tax-rates').expect(200);
      await get(carol, acmeId, '/suppliers').expect(200);
      const res = await post(carol, acmeId, '/product-categories', {
        name: 'Divers',
      }).expect(403);
      expect(res.body.error.code).toBe('PERMISSION_DENIED');
    });

    it('keeps each shop’s lists to itself', async () => {
      const acmeCategory = (
        await get(alice, acmeId, '/product-categories').expect(200)
      ).body[0];
      expect(
        (await get(bob, globexId, '/product-categories').expect(200)).body,
      ).toEqual([]);
      for (const path of [`/product-categories/${acmeCategory.id}`]) {
        const res = await patch(bob, globexId, path, { name: 'Volé' }).expect(
          404,
        );
        expect(res.body.error.code).toBe('CATEGORY_NOT_FOUND');
      }
      const acmeSupplier = (await get(alice, acmeId, '/suppliers').expect(200))
        .body[0];
      await patch(bob, globexId, `/suppliers/${acmeSupplier.id}`, {
        name: 'Volé',
      }).expect(404);
      const acmeTax = (await get(alice, acmeId, '/tax-rates').expect(200))
        .body[0];
      await patch(bob, globexId, `/tax-rates/${acmeTax.id}`, {
        name: 'Volé',
      }).expect(404);
      // Another shop's header without membership: same 404 as a missing shop.
      await get(bob, acmeId, '/tax-rates').expect(404);
    });
  });

  describe('products', () => {
    it('creates a product with its initial stock as a movement', async () => {
      const created = await createProduct({
        initialStock: 12,
        lowStockThreshold: 3,
      });
      expect(created).toMatchObject({
        stockQuantity: 12,
        stockLevel: 'ok',
        version: 1,
        photoVersion: null,
      });
      const movements = (
        await get(alice, acmeId, `/products/${created.id}/movements`).expect(
          200,
        )
      ).body;
      expect(movements).toEqual([
        expect.objectContaining({
          kind: 'initial',
          quantity: 12,
          unitCost: 700,
        }),
      ]);
    });

    it('answers a replayed creation with the same product, without duplicating it', async () => {
      const body = product({ initialStock: 5 });
      const first = await post(alice, acmeId, '/products', body).expect(201);
      const again = await post(alice, acmeId, '/products', body).expect(200);
      expect(again.body.id).toBe(first.body.id);
      expect(await movementCount(first.body.id)).toBe(1);
    });

    it('refuses a category or a tax rate of another shop', async () => {
      const globexCategory = (
        await post(bob, globexId, '/product-categories', {
          name: 'Globex',
        }).expect(201)
      ).body;
      const globexTax = (
        await post(bob, globexId, '/tax-rates', {
          name: 'TVA Globex',
          rateBasisPoints: 1800,
        }).expect(201)
      ).body;
      const byCategory = await post(
        alice,
        acmeId,
        '/products',
        product({ categoryId: globexCategory.id }),
      ).expect(400);
      expect(byCategory.body.error.details).toEqual([
        { path: 'categoryId', message: 'Catégorie inconnue.' },
      ]);
      const byTax = await post(
        alice,
        acmeId,
        '/products',
        product({ taxRateId: globexTax.id }),
      ).expect(400);
      expect(byTax.body.error.details).toEqual([
        { path: 'taxRateId', message: 'Taxe inconnue.' },
      ]);
    });

    it('keeps names and barcodes unique among active products', async () => {
      await createProduct({ name: 'Savon Kiss', barcode: '6001234567890' });
      const byName = await post(
        alice,
        acmeId,
        '/products',
        product({ name: 'savon kiss' }),
      ).expect(409);
      expect(byName.body.error.code).toBe('NAME_TAKEN');
      const byBarcode = await post(
        alice,
        acmeId,
        '/products',
        product({ barcode: '6001234567890' }),
      ).expect(409);
      expect(byBarcode.body.error.code).toBe('BARCODE_TAKEN');
      // Another shop may use the same name and barcode.
      await createProduct(
        { name: 'Savon Kiss', barcode: '6001234567890' },
        bob,
        globexId,
      );
    });

    it('refuses decimals for products counted in whole units', async () => {
      const res = await post(
        alice,
        acmeId,
        '/products',
        product({ initialStock: 2.5 }),
      ).expect(400);
      expect(res.body.error.details[0].path).toBe('initialStock');
      await createProduct({ unit: 'kg', initialStock: 2.5 });
    });

    it('searches by name or barcode and filters by stock level', async () => {
      const low = await createProduct({
        name: 'Lait en poudre',
        initialStock: 2,
        lowStockThreshold: 5,
      });
      const out = await createProduct({ name: 'Lait concentré' });
      const ok = await createProduct({
        name: 'Lait frais',
        initialStock: 50,
        lowStockThreshold: 5,
        barcode: 'LAIT-001',
      });

      const names = (body: { name: string }[]) => body.map((p) => p.name);
      expect(
        names((await get(alice, acmeId, '/products?q=LAIT').expect(200)).body),
      ).toEqual(['Lait concentré', 'Lait en poudre', 'Lait frais']);
      expect(
        (await get(alice, acmeId, '/products?q=LAIT-001').expect(200)).body[0]
          .id,
      ).toBe(ok.id);
      // LIKE wildcards are searched literally.
      expect(
        (await get(alice, acmeId, '/products?q=%25').expect(200)).body,
      ).toEqual([]);

      const lowIds = (
        await get(alice, acmeId, '/products?q=lait&stock=low').expect(200)
      ).body.map((p: { id: string }) => p.id);
      expect(lowIds.sort()).toEqual([low.id, out.id].sort());
      const outIds = (
        await get(alice, acmeId, '/products?q=lait&stock=out').expect(200)
      ).body.map((p: { id: string }) => p.id);
      expect(outIds).toEqual([out.id]);
      await get(alice, acmeId, '/products?stock=everything').expect(400);
    });

    it('detects a stale version instead of overwriting another device’s change', async () => {
      const created = await createProduct();
      const updated = await patch(alice, acmeId, `/products/${created.id}`, {
        salePrice: 1200,
        version: 1,
      }).expect(200);
      expect(updated.body).toMatchObject({ salePrice: 1200, version: 2 });
      const stale = await patch(alice, acmeId, `/products/${created.id}`, {
        salePrice: 1500,
        version: 1,
      }).expect(409);
      expect(stale.body.error.code).toBe('VERSION_CONFLICT');
    });

    it('archives a product, which frees its name', async () => {
      const created = await createProduct({ name: 'Ancien produit' });
      await patch(alice, acmeId, `/products/${created.id}`, {
        status: 'archived',
        version: 1,
      }).expect(200);
      const active = (
        await get(alice, acmeId, '/products?q=Ancien').expect(200)
      ).body;
      expect(active).toEqual([]);
      const archived = (
        await get(alice, acmeId, '/products?q=Ancien&status=archived').expect(
          200,
        )
      ).body;
      expect(archived.map((p: { id: string }) => p.id)).toEqual([created.id]);
      await createProduct({ name: 'Ancien produit' });
      const { rows } = await ctx.admin.query(
        `select action from app.audit_logs where target_id = $1 order by id`,
        [created.id],
      );
      expect(rows.map((r) => r.action)).toEqual([
        'product.created',
        'product.archived',
      ]);
    });

    it('applies the product cap of the shop', async () => {
      await ctx.admin.query(
        'update app.organizations set max_products = 1 where id = $1',
        [globexId],
      );
      const res = await post(bob, globexId, '/products', product()).expect(409);
      expect(res.body.error.code).toBe('CATALOG_LIMIT_REACHED');
      await ctx.admin.query(
        'update app.organizations set max_products = null where id = $1',
        [globexId],
      );
    });

    it('lets sellers see products but not create or change them', async () => {
      const created = await createProduct();
      await get(carol, acmeId, `/products/${created.id}`).expect(200);
      await post(carol, acmeId, '/products', product()).expect(403);
      await patch(carol, acmeId, `/products/${created.id}`, {
        salePrice: 1,
        version: 1,
      }).expect(403);
    });

    it('never shows or changes a product of another shop', async () => {
      const created = await createProduct({ name: 'Secret Acme' });
      for (const path of [
        `/products/${created.id}`,
        `/products/${created.id}/movements`,
        `/products/${created.id}/photo`,
      ]) {
        const res = await get(bob, globexId, path).expect(404);
        expect(res.body.error.code).toBe('PRODUCT_NOT_FOUND');
      }
      expect(
        (await get(bob, globexId, '/products?q=Secret').expect(200)).body,
      ).toEqual([]);
      await patch(bob, globexId, `/products/${created.id}`, {
        salePrice: 1,
        version: 1,
      }).expect(404);
      await move(
        created.id,
        { kind: 'purchase', quantity: 1 },
        bob,
        globexId,
      ).expect(404);
      await ctx
        .http()
        .put(`/api/v1/products/${created.id}/photo`)
        .set(as(bob, globexId))
        .set('Content-Type', 'image/webp')
        .send(WEBP)
        .expect(404);
      await ctx
        .http()
        .delete(`/api/v1/products/${created.id}/photo`)
        .set(as(bob, globexId))
        .expect(404);
      await get(alice, acmeId, '/products/not-a-uuid').expect(404);
    });
  });

  describe('photos', () => {
    const put = (productId: string, data: Buffer, type: string, user = alice) =>
      ctx
        .http()
        .put(`/api/v1/products/${productId}/photo`)
        .set(as(user, acmeId))
        .set('Content-Type', type)
        .send(data);

    it('stores a photo, serves it back, and removes it', async () => {
      const created = await createProduct();
      const saved = await put(created.id, WEBP, 'image/webp').expect(200);
      expect(saved.body.photoVersion).toMatch(/^[0-9a-f]{16}$/);
      const served = await get(carol, acmeId, `/products/${created.id}/photo`)
        .buffer(true)
        .parse((res, done) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => done(null, Buffer.concat(chunks)));
        })
        .expect(200);
      expect(served.headers['content-type']).toBe('image/webp');
      expect(Buffer.compare(served.body as Buffer, WEBP)).toBe(0);

      const removed = await ctx
        .http()
        .delete(`/api/v1/products/${created.id}/photo`)
        .set(as(alice, acmeId))
        .expect(200);
      expect(removed.body.photoVersion).toBeNull();
      const gone = await get(
        alice,
        acmeId,
        `/products/${created.id}/photo`,
      ).expect(404);
      expect(gone.body.error.code).toBe('PHOTO_NOT_FOUND');
    });

    it('checks the image signature, not only the declared type, and the size', async () => {
      const created = await createProduct();
      await put(
        created.id,
        Buffer.from('<script>alert(1)</script>'),
        'image/png',
      ).expect(400);
      await put(created.id, WEBP, 'image/jpeg').expect(400);
      const big = Buffer.concat([WEBP, Buffer.alloc(600 * 1024)]);
      const res = await put(created.id, big, 'image/webp').expect(413);
      expect(res.body.error.code).toBe('PHOTO_TOO_LARGE');
      await put(created.id, WEBP, 'image/webp', carol).expect(403);
    });
  });

  describe('stock movements', () => {
    it('records purchases, losses and inventories, and keeps the stock as their sum', async () => {
      const supplier = (
        await post(alice, acmeId, '/suppliers', {
          name: 'Grossiste Médina',
        }).expect(201)
      ).body;
      const created = await createProduct({
        initialStock: 10,
        lowStockThreshold: 4,
      });

      const purchase = await move(created.id, {
        kind: 'purchase',
        quantity: 6,
        unitCost: 650,
        supplierId: supplier.id,
      }).expect(201);
      expect(purchase.body.movement).toMatchObject({
        kind: 'purchase',
        quantity: 6,
        unitCost: 650,
        supplier: { id: supplier.id, name: 'Grossiste Médina' },
        createdBy: { userId: alice.id },
      });
      expect(purchase.body.product.stockQuantity).toBe(16);

      const loss = await move(created.id, {
        kind: 'loss',
        quantity: 3,
        reason: 'Cassés',
      }).expect(201);
      expect(loss.body.movement.quantity).toBe(-3);
      expect(loss.body.product.stockQuantity).toBe(13);

      const inventory = await move(created.id, {
        kind: 'inventory',
        countedQuantity: 4,
      }).expect(201);
      expect(inventory.body.movement).toMatchObject({
        quantity: -9,
        countedQuantity: 4,
      });
      expect(inventory.body.product).toMatchObject({
        stockQuantity: 4,
        stockLevel: 'low',
      });

      const same = await move(created.id, {
        kind: 'inventory',
        countedQuantity: 4,
      }).expect(201);
      expect(same.body.movement.quantity).toBe(0);

      const history = (
        await get(carol, acmeId, `/products/${created.id}/movements`).expect(
          200,
        )
      ).body;
      expect(history.map((m: { kind: string }) => m.kind)).toEqual([
        'inventory',
        'inventory',
        'loss',
        'purchase',
        'initial',
      ]);
      const { rows } = await ctx.admin.query(
        `select metadata from app.audit_logs
         where target_id = $1 and action = 'stock.moved' order by id`,
        [created.id],
      );
      expect(rows[0].metadata).toMatchObject({
        kind: 'purchase',
        stockBefore: 10,
        stockAfter: 16,
      });
    });

    it('answers a replayed movement without recording it twice', async () => {
      const created = await createProduct({ initialStock: 1 });
      const body = {
        kind: 'purchase',
        quantity: 2,
        clientOperationId: randomUUID(),
      };
      const first = await post(
        alice,
        acmeId,
        `/products/${created.id}/movements`,
        body,
      ).expect(201);
      const again = await post(
        alice,
        acmeId,
        `/products/${created.id}/movements`,
        body,
      ).expect(200);
      expect(again.body.movement.id).toBe(first.body.movement.id);
      expect(again.body.product.stockQuantity).toBe(3);
      expect(await movementCount(created.id)).toBe(2);

      const other = await createProduct();
      const reused = await post(
        alice,
        acmeId,
        `/products/${other.id}/movements`,
        body,
      ).expect(409);
      expect(reused.body.error.code).toBe('OPERATION_ID_REUSED');
    });

    it('refuses to lose more than the stock, and asks why', async () => {
      const created = await createProduct({ initialStock: 2 });
      const res = await move(created.id, {
        kind: 'loss',
        quantity: 3,
        reason: 'Périmés',
      }).expect(409);
      expect(res.body.error.code).toBe('STOCK_INSUFFICIENT');
      await move(created.id, { kind: 'loss', quantity: 1 }).expect(400);
    });

    it('refuses movements on untracked or archived products, and decimals in whole units', async () => {
      const untracked = await createProduct({ trackStock: false });
      expect(
        (
          await move(untracked.id, { kind: 'purchase', quantity: 1 }).expect(
            409,
          )
        ).body.error.code,
      ).toBe('STOCK_NOT_TRACKED');
      const archived = await createProduct();
      await patch(alice, acmeId, `/products/${archived.id}`, {
        status: 'archived',
        version: 1,
      }).expect(200);
      expect(
        (await move(archived.id, { kind: 'purchase', quantity: 1 }).expect(409))
          .body.error.code,
      ).toBe('PRODUCT_ARCHIVED');
      const whole = await createProduct();
      await move(whole.id, { kind: 'purchase', quantity: 1.5 }).expect(400);
    });

    it('refuses a supplier of another shop and keeps losses and inventories to managers', async () => {
      const globexSupplier = (
        await post(bob, globexId, '/suppliers', {
          name: 'Fournisseur Globex',
        }).expect(201)
      ).body;
      const created = await createProduct();
      const res = await move(created.id, {
        kind: 'purchase',
        quantity: 1,
        supplierId: globexSupplier.id,
      }).expect(400);
      expect(res.body.error.details).toEqual([
        { path: 'supplierId', message: 'Fournisseur inconnu.' },
      ]);
      // Sellers record deliveries (ADR-036), not losses nor inventories.
      await move(created.id, { kind: 'purchase', quantity: 1 }, carol).expect(
        201,
      );
      const loss = await move(
        created.id,
        { kind: 'loss', quantity: 1, reason: 'Cassé' },
        carol,
      ).expect(403);
      expect(loss.body.error.code).toBe('PERMISSION_DENIED');
      await move(
        created.id,
        { kind: 'inventory', countedQuantity: 0 },
        carol,
      ).expect(403);
    });
  });

  describe('stock summary', () => {
    it('counts alerts and values the stock of the shop only', async () => {
      await createProduct(
        { name: 'Résumé Globex', initialStock: 1000 },
        bob,
        globexId,
      );
      const summary = (await get(carol, acmeId, '/stock/summary').expect(200))
        .body;
      const products = (await get(alice, acmeId, '/products').expect(200))
        .body as {
        trackStock: boolean;
        stockQuantity: number;
        purchasePrice: number | null;
        stockLevel: string;
      }[];
      const tracked = products.filter((p) => p.trackStock);
      expect(summary.trackedProducts).toBe(tracked.length);
      expect(summary.outOfStock).toBe(
        tracked.filter((p) => p.stockLevel === 'out').length,
      );
      expect(summary.lowStock).toBe(
        tracked.filter((p) => p.stockLevel === 'low').length,
      );
      expect(summary.stockValue).toBe(
        Math.round(
          tracked
            .filter((p) => p.stockQuantity > 0 && p.purchasePrice !== null)
            .reduce((sum, p) => sum + p.stockQuantity * p.purchasePrice!, 0),
        ),
      );
      expect(summary.alerts.length).toBeLessThanOrEqual(10);
      expect(summary.alerts[0].stockLevel).toBe('out');
      expect(summary.alerts.map((a: { name: string }) => a.name)).not.toContain(
        'Résumé Globex',
      );
    });
  });

  describe('database guarantees', () => {
    it('keeps the stock ledger append-only, even for the API role', async () => {
      const created = await createProduct({ initialStock: 1 });
      await expect(
        ctx.admin.query(
          'update app.stock_movements set quantity = 100 where product_id = $1',
          [created.id],
        ),
      ).rejects.toThrow();
      await expect(
        ctx.admin.query(
          'delete from app.stock_movements where product_id = $1',
          [created.id],
        ),
      ).rejects.toThrow();
    });

    it('never links a product to another shop’s category, even in SQL', async () => {
      const { rows } = await ctx.admin.query<{ id: string }>(
        `select id from app.product_categories where organization_id = $1 limit 1`,
        [globexId],
      );
      await expect(
        ctx.admin.query(
          `insert into app.products (organization_id, name, category_id, unit, sale_price, client_operation_id, created_by)
           values ($1, 'Intrus', $2, 'piece', 100, gen_random_uuid(), $3)`,
          [acmeId, rows[0]!.id, alice.id],
        ),
      ).rejects.toThrow(/foreign key/);
    });
  });
});
