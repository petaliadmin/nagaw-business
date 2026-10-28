import { randomUUID } from 'node:crypto';
import type { TestContext, TestUser } from './support/app.js';
import { createTestContext } from './support/app.js';

/** Selling units and negotiated prices (ADR-038). */
describe('Selling units and negotiated prices', () => {
  let ctx: TestContext;
  let alice: TestUser; // owner of Acme
  let bob: TestUser; // owner of Globex
  let carol: TestUser; // seller (member) of Acme
  let acmeId: string;
  let globexId: string;
  let rice: { id: string }; // 650 F the kg, bought 500 F the kg, 200 kg
  let sack: { id: string; version: number }; // sac de 50 kg, 30 000 F
  let fabric: { id: string }; // 2 500 F the metre, stock not tracked
  let globexProduct: { id: string };

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

  const addUnit = (
    productId: string,
    body: object,
    user = alice,
    orgId = acmeId,
  ) =>
    post(user, orgId, `/products/${productId}/units`, {
      clientOperationId: randomUUID(),
      ...body,
    });
  const cashSale = (lines: object[], total: number, user = alice) =>
    post(user, acmeId, '/sales', {
      clientOperationId: randomUUID(),
      lines,
      payments: [{ method: 'cash', amount: total }],
      expectedTotal: total,
    });
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
    await ctx.setPlan(acmeId, 'pro');
    await ctx.admin.query(
      `insert into app.organization_memberships (organization_id, user_id, role)
       values ($1, $2, 'member')`,
      [acmeId, carol.id],
    );
    const product = async (fields: object, user = alice, orgId = acmeId) =>
      (
        await post(user, orgId, '/products', {
          categoryId: null,
          purchasePrice: null,
          taxRateId: null,
          barcode: null,
          lowStockThreshold: null,
          trackStock: true,
          initialStock: null,
          clientOperationId: randomUUID(),
          ...fields,
        }).expect(201)
      ).body;
    rice = await product({
      name: 'Riz parfumé',
      unit: 'kg',
      salePrice: 650,
      purchasePrice: 500,
      initialStock: 200,
    });
    fabric = await product({
      name: 'Bazin',
      unit: 'metre',
      salePrice: 2500,
      trackStock: false,
    });
    globexProduct = await product(
      { name: 'Riz Globex', unit: 'kg', salePrice: 600, initialStock: 10 },
      bob,
      globexId,
    );
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('catalogue', () => {
    it('adds selling units to a product, once per operation id', async () => {
      const body = {
        label: 'Sac de 50 kg',
        factor: 50,
        salePrice: 30000,
        barcode: '6001234500001',
        clientOperationId: randomUUID(),
      };
      const created = await post(
        alice,
        acmeId,
        `/products/${rice.id}/units`,
        body,
      ).expect(201);
      expect(created.body.units).toEqual([
        expect.objectContaining({
          label: 'Sac de 50 kg',
          factor: 50,
          salePrice: 30000,
          allowsDecimals: false,
          barcode: '6001234500001',
          status: 'active',
          version: 1,
        }),
      ]);
      sack = created.body.units[0];
      const replay = await post(
        alice,
        acmeId,
        `/products/${rice.id}/units`,
        body,
      ).expect(200);
      expect(replay.body.units).toHaveLength(1);

      await addUnit(rice.id, {
        label: 'Demi-kilo',
        factor: 0.5,
        salePrice: 350,
      }).expect(201);
      // Smallest first, in the list as in the product.
      const listed = (
        await get(alice, acmeId, '/products?q=riz').expect(200)
      ).body.find((p: { id: string }) => p.id === rice.id);
      expect(listed.units.map((u: { label: string }) => u.label)).toEqual([
        'Demi-kilo',
        'Sac de 50 kg',
      ]);
      // The barcode of the sack finds the rice.
      const scanned = (
        await get(alice, acmeId, '/products?q=6001234500001').expect(200)
      ).body;
      expect(scanned.map((p: { id: string }) => p.id)).toEqual([rice.id]);
    });

    it('checks names, barcodes, whole numbers and the cap', async () => {
      const taken = await addUnit(rice.id, {
        label: 'sac de 50 KG',
        factor: 25,
        salePrice: 1,
      }).expect(409);
      expect(taken.body.error.code).toBe('NAME_TAKEN');
      // A barcode names one thing in the shop: product or unit.
      const barcode = await addUnit(fabric.id, {
        label: 'Pièce de 6 m',
        factor: 6,
        salePrice: 13500,
        barcode: '6001234500001',
      }).expect(409);
      expect(barcode.body.error.code).toBe('BARCODE_TAKEN');
      await post(alice, acmeId, '/products', {
        name: 'Autre',
        categoryId: null,
        unit: 'piece',
        salePrice: 1,
        purchasePrice: null,
        taxRateId: null,
        barcode: '6001234500001',
        trackStock: false,
        lowStockThreshold: null,
        clientOperationId: randomUUID(),
      }).expect(409);
      // A product counted in pieces takes whole numbers of them.
      const water = (
        await post(alice, acmeId, '/products', {
          name: 'Eau',
          categoryId: null,
          unit: 'bouteille',
          salePrice: 300,
          purchasePrice: null,
          taxRateId: null,
          barcode: null,
          trackStock: false,
          lowStockThreshold: null,
          clientOperationId: randomUUID(),
        }).expect(201)
      ).body;
      await addUnit(water.id, {
        label: 'Demi-pack',
        factor: 2.5,
        salePrice: 1,
      }).expect(400);
      // The cap lives in the database.
      await ctx.admin.query(
        `update app.organizations set max_product_units = 1 where id = $1`,
        [acmeId],
      );
      await addUnit(water.id, {
        label: 'Pack',
        factor: 6,
        salePrice: 1700,
      }).expect(201);
      const capped = await addUnit(water.id, {
        label: 'Carton',
        factor: 12,
        salePrice: 3300,
      }).expect(409);
      expect(capped.body.error.code).toBe('CATALOG_LIMIT_REACHED');
      await ctx.admin.query(
        `update app.organizations set max_product_units = 10 where id = $1`,
        [acmeId],
      );
      // Sellers do not manage the catalogue.
      await addUnit(
        water.id,
        { label: 'Lot', factor: 3, salePrice: 1 },
        carol,
      ).expect(403);
    });

    it('changes the price of a unit, never its factor', async () => {
      const updated = await patch(
        alice,
        acmeId,
        `/products/${rice.id}/units/${sack.id}`,
        { salePrice: 29500, version: sack.version },
      ).expect(200);
      const unit = updated.body.units.find(
        (u: { id: string }) => u.id === sack.id,
      );
      expect(unit).toMatchObject({ salePrice: 29500, version: 2 });
      await patch(alice, acmeId, `/products/${rice.id}/units/${sack.id}`, {
        salePrice: 1,
        version: 1,
      }).expect(409);
      await patch(alice, acmeId, `/products/${rice.id}/units/${sack.id}`, {
        factor: 25,
        version: 2,
      }).expect(400);
      // Not even the database lets it change.
      await expect(
        ctx.admin.query(
          `update app.product_units set factor = 25 where id = $1`,
          [sack.id],
        ),
      ).rejects.toThrow(/never changes/);
      // The stock unit cannot change under its selling units.
      const refused = await patch(alice, acmeId, `/products/${rice.id}`, {
        unit: 'g',
        version: 1,
      }).expect(400);
      expect(refused.body.error.details[0].message).toContain(
        'unités de vente',
      );
      await patch(alice, acmeId, `/products/${rice.id}/units/${sack.id}`, {
        salePrice: 30000,
        version: 2,
      }).expect(200);
      sack = { id: sack.id, version: 3 };
    });

    it('keeps the units of a shop to that shop', async () => {
      await addUnit(
        rice.id,
        { label: 'Tonne', factor: 1000, salePrice: 1 },
        bob,
        globexId,
      ).expect(404);
      await patch(bob, globexId, `/products/${rice.id}/units/${sack.id}`, {
        salePrice: 1,
        version: 3,
      }).expect(404);
      // A unit of Acme named under a Globex product is not found either.
      await patch(
        bob,
        globexId,
        `/products/${globexProduct.id}/units/${sack.id}`,
        { salePrice: 1, version: 3 },
      ).expect(404);
    });
  });

  describe('sales', () => {
    it('takes the selling unit out of the stock in the stock unit', async () => {
      const before = await stockOf(rice.id);
      const sale = (
        await cashSale(
          [
            { productId: rice.id, productUnitId: sack.id, quantity: 2 },
            { productId: rice.id, quantity: 1.5 },
          ],
          60975,
        ).expect(201)
      ).body;
      expect(sale.lines[0]).toMatchObject({
        unit: 'kg',
        productUnitId: sack.id,
        unitLabel: 'Sac de 50 kg',
        unitFactor: 50,
        unitPrice: 30000,
        quantity: 2,
        baseQuantity: 100,
        listTotal: 60000,
        lineTotal: 60000,
      });
      expect(sale.lines[1]).toMatchObject({
        productUnitId: null,
        unitFactor: 1,
        baseQuantity: 1.5,
      });
      expect(await stockOf(rice.id)).toBe(before - 101.5);
      // The cost is kept per kg, × the stock taken for the margin.
      const { rows } = await ctx.admin.query(
        `select unit_cost, base_quantity from app.sale_lines where sale_id = $1 order by position`,
        [sale.id],
      );
      expect(
        rows.map((r) => Number(r.unit_cost) * Number(r.base_quantity)),
      ).toEqual([50000, 750]);
    });

    it('refuses a unit of another product or shop, and half a sack', async () => {
      const foreign = await cashSale(
        [{ productId: globexProduct.id, productUnitId: sack.id, quantity: 1 }],
        30000,
      ).expect(400);
      expect(foreign.body.error.details[0].path).toBe('lines.0.productId');
      const other = await cashSale(
        [{ productId: fabric.id, productUnitId: sack.id, quantity: 1 }],
        30000,
      ).expect(400);
      expect(other.body.error.details[0].path).toBe('lines.0.productUnitId');
      await cashSale(
        [{ productId: rice.id, productUnitId: sack.id, quantity: 0.5 }],
        15000,
      ).expect(400);
      // Bob cannot sell Acme's rice by its unit from Globex.
      await post(bob, globexId, '/sales', {
        clientOperationId: randomUUID(),
        lines: [{ productId: rice.id, productUnitId: sack.id, quantity: 1 }],
        payments: [{ method: 'cash', amount: 30000 }],
        expectedTotal: 30000,
      }).expect(400);
    });

    it('records the price agreed with the customer next to the catalogue one', async () => {
      const sale = (
        await cashSale(
          [
            {
              productId: rice.id,
              productUnitId: sack.id,
              quantity: 1,
              agreedTotal: 28000,
            },
            // « 1 000 F of rice »: the device worked out the quantity.
            { productId: rice.id, quantity: 1.538, agreedTotal: 1000 },
          ],
          29000,
          carol,
        ).expect(201)
      ).body;
      expect(sale).toMatchObject({
        subtotal: 29000,
        discount: 0,
        total: 29000,
      });
      expect(sale.lines.map((l: { listTotal: number }) => l.listTotal)).toEqual(
        [30000, 1000],
      );
      expect(sale.lines.map((l: { lineTotal: number }) => l.lineTotal)).toEqual(
        [28000, 1000],
      );
      const audit = await ctx.admin.query(
        `select metadata from app.audit_logs
          where organization_id = $1 and action = 'sale.completed' and target_id = $2`,
        [acmeId, sale.id],
      );
      expect(audit.rows[0].metadata).toMatchObject({ negotiated: 2000 });
      // The invoice shows the catalogue prices and the reduction.
      const customer = (
        await post(alice, acmeId, '/customers', {
          name: 'Awa Diop',
          clientOperationId: randomUUID(),
        }).expect(201)
      ).body;
      const invoice = (
        await post(alice, acmeId, `/invoices/from-sale/${sale.id}`, {
          customerId: customer.id,
          clientOperationId: randomUUID(),
        }).expect(201)
      ).body;
      expect(invoice.lines[0]).toMatchObject({
        label: 'Riz parfumé (Sac de 50 kg)',
        unit: 'sac',
        quantity: 1,
        unitPrice: 30000,
      });
      expect(invoice.totals.total).toBe(29000);
    });

    it('limits the reduction of a seller only when a limit is set', async () => {
      const big = [
        { productId: fabric.id, quantity: 4, agreedTotal: 7000 }, // −30 %
      ];
      await cashSale(big, 7000, carol).expect(201);
      const setLimit = (value: number | null, user = alice) =>
        patch(user, acmeId, `/organizations/current/members/${carol.id}`, {
          maxDiscountBasisPoints: value,
        });
      await setLimit(2000).expect(200);
      const refused = await cashSale(big, 7000, carol).expect(403);
      expect(refused.body.error.code).toBe('DISCOUNT_NOT_ALLOWED');
      // Negotiation and discount add up against the limit.
      const both = await post(carol, acmeId, '/sales', {
        clientOperationId: randomUUID(),
        lines: [{ productId: fabric.id, quantity: 4, agreedTotal: 9000 }],
        discount: 1500,
        payments: [{ method: 'cash', amount: 7500 }],
        expectedTotal: 7500,
      }).expect(403);
      expect(both.body.error.code).toBe('DISCOUNT_NOT_ALLOWED');
      await cashSale(
        [{ productId: fabric.id, quantity: 4, agreedTotal: 8000 }],
        8000,
        carol,
      ).expect(201);
      // A customer who pays more is never refused.
      await cashSale(
        [{ productId: fabric.id, quantity: 1, agreedTotal: 3000 }],
        3000,
        carol,
      ).expect(201);
      // The members list shows the limit; another shop's owner cannot set it.
      const members = (
        await get(alice, acmeId, '/organizations/current/members').expect(200)
      ).body;
      expect(
        members.find((m: { userId: string }) => m.userId === carol.id),
      ).toMatchObject({ maxDiscountBasisPoints: 2000 });
      await patch(bob, globexId, `/organizations/current/members/${carol.id}`, {
        maxDiscountBasisPoints: null,
      }).expect(404);
      await setLimit(null).expect(200);
      await cashSale(big, 7000, carol).expect(201);
    });

    it('refuses a seller a sale under the purchase price unless the shop allows it', async () => {
      // A sack bought 25 000 F sold 24 000 F.
      const lossy = [
        {
          productId: rice.id,
          productUnitId: sack.id,
          quantity: 1,
          agreedTotal: 24000,
        },
      ];
      const refused = await cashSale(lossy, 24000, carol).expect(403);
      expect(refused.body.error.code).toBe('BELOW_COST_NOT_ALLOWED');
      expect(refused.body.error.message).toContain('Riz parfumé');
      // A discount that brings the line under its cost counts too.
      await post(carol, acmeId, '/sales', {
        clientOperationId: randomUUID(),
        lines: [{ productId: rice.id, productUnitId: sack.id, quantity: 1 }],
        discount: 5500,
        payments: [{ method: 'cash', amount: 24500 }],
        expectedTotal: 24500,
      }).expect(403);
      // The owner may, and the managers are told.
      const sale = (await cashSale(lossy, 24000, alice).expect(201)).body;
      const audit = await ctx.admin.query(
        `select metadata from app.audit_logs
          where organization_id = $1 and action = 'sale.completed' and target_id = $2`,
        [acmeId, sale.id],
      );
      expect(audit.rows[0].metadata.belowCost).toEqual([
        { name: 'Riz parfumé', loss: 1000 },
      ]);
      // The setting lives in the database.
      await ctx.admin.query(
        `update app.organizations set seller_can_sell_below_cost = true where id = $1`,
        [acmeId],
      );
      await cashSale(lossy, 24000, carol).expect(201);
      const { rows } = await ctx.admin.query(
        `select body from app.notifications
          where organization_id = $1 and recipient_id = $2 and kind = 'sale.review'
          order by created_at desc limit 1`,
        [acmeId, alice.id],
      );
      expect(rows[0].body).toContain('sous son prix d’achat');
      await ctx.admin.query(
        `update app.organizations set seller_can_sell_below_cost = false where id = $1`,
        [acmeId],
      );
    });

    it('accepts offline sales in a selling unit at a negotiated price', async () => {
      const device = (
        await post(carol, acmeId, '/devices', {
          label: 'Comptoir',
          clientOperationId: randomUUID(),
        }).expect(201)
      ).body;
      const before = await stockOf(rice.id);
      const res = await post(carol, acmeId, '/sync', {
        deviceId: device.id,
        operations: [
          {
            type: 'sale',
            clientOperationId: randomUUID(),
            data: {
              deviceTicket: `${device.ticketPrefix}-000001`,
              occurredAt: new Date().toISOString(),
              lines: [
                {
                  productId: rice.id,
                  productUnitId: sack.id,
                  quantity: 2,
                  unitPrice: 30000,
                  agreedTotal: 58000,
                },
              ],
              payments: [{ method: 'cash', amount: 58000 }],
            },
          },
        ],
      }).expect(200);
      // A negotiated price is not a price to check.
      expect(res.body.results[0]).toMatchObject({
        status: 'accepted',
        priceReview: false,
      });
      expect(await stockOf(rice.id)).toBe(before - 100);
      // The seller's own figures count kilos, not sacks.
      const stats = (await get(carol, acmeId, '/sales/my-stats').expect(200))
        .body;
      const top = stats.topProducts.find(
        (p: { productId: string }) => p.productId === rice.id,
      );
      // 1 sack + 1,538 kg, 1 sack, then 2 sacks offline.
      expect(top.quantity).toBe(201.538);
    });
  });

  describe('conversions, computed prices and templates', () => {
    it('sells grams of a product counted in kg, priced from the kg', async () => {
      const before = await stockOf(rice.id);
      const sale = (
        await cashSale(
          [{ productId: rice.id, conversion: 'g', quantity: 250 }],
          163,
        ).expect(201)
      ).body;
      expect(sale.lines[0]).toMatchObject({
        productUnitId: null,
        unitLabel: 'g',
        unitFactor: 0.001,
        priceBasis: 'stock',
        unitPrice: 650,
        quantity: 250,
        baseQuantity: 0.25,
        listTotal: 163,
        lineTotal: 163,
      });
      expect(await stockOf(rice.id)).toBe(before - 0.25);
      // Not every conversion fits every product; one unit per line.
      const wrong = await cashSale(
        [{ productId: rice.id, conversion: 'cm', quantity: 10 }],
        65,
      ).expect(400);
      expect(wrong.body.error.details[0].path).toBe('lines.0.conversion');
      await cashSale(
        [
          {
            productId: rice.id,
            productUnitId: sack.id,
            conversion: 'g',
            quantity: 1,
          },
        ],
        1,
      ).expect(400);
      await cashSale(
        [{ productId: rice.id, conversion: 'g', quantity: 2.5 }],
        2,
      ).expect(400);
      // On the invoice: the stock taken, at the price of the kg.
      const customer = (
        await post(alice, acmeId, '/customers', {
          name: 'Fatou Sow',
          clientOperationId: randomUUID(),
        }).expect(201)
      ).body;
      const invoice = (
        await post(alice, acmeId, `/invoices/from-sale/${sale.id}`, {
          customerId: customer.id,
          clientOperationId: randomUUID(),
        }).expect(201)
      ).body;
      expect(invoice.lines[0]).toMatchObject({
        label: 'Riz parfumé (g)',
        unit: 'kg',
        quantity: 0.25,
        unitPrice: 650,
      });
      expect(invoice.totals.total).toBe(163);
    });

    it('prices a unit without its own price from the stock unit', async () => {
      const created = (
        await addUnit(rice.id, { label: 'Demi-sac', factor: 25 }).expect(201)
      ).body;
      const half = created.units.find(
        (u: { label: string }) => u.label === 'Demi-sac',
      );
      expect(half).toMatchObject({ salePrice: null, factor: 25 });
      const computed = (
        await cashSale(
          [{ productId: rice.id, productUnitId: half.id, quantity: 1 }],
          16250,
        ).expect(201)
      ).body;
      expect(computed.lines[0]).toMatchObject({
        priceBasis: 'stock',
        unitPrice: 650,
        baseQuantity: 25,
        lineTotal: 16250,
      });
      // A price of its own, then back to the computed one.
      await patch(alice, acmeId, `/products/${rice.id}/units/${half.id}`, {
        salePrice: 16000,
        version: half.version,
      }).expect(200);
      const fixed = (
        await cashSale(
          [{ productId: rice.id, productUnitId: half.id, quantity: 1 }],
          16000,
        ).expect(201)
      ).body;
      expect(fixed.lines[0]).toMatchObject({
        priceBasis: 'unit',
        unitPrice: 16000,
      });
      const back = await patch(
        alice,
        acmeId,
        `/products/${rice.id}/units/${half.id}`,
        { salePrice: null, version: half.version + 1 },
      ).expect(200);
      expect(
        back.body.units.find((u: { id: string }) => u.id === half.id).salePrice,
      ).toBeNull();
    });

    it('keeps the unit templates of a shop to that shop', async () => {
      const body = {
        label: 'Sac de 25 kg',
        stockUnit: 'kg',
        factor: 25,
        clientOperationId: randomUUID(),
      };
      const created = await post(alice, acmeId, '/unit-templates', body).expect(
        201,
      );
      expect(created.body).toMatchObject({
        label: 'Sac de 25 kg',
        stockUnit: 'kg',
        factor: 25,
        allowsDecimals: false,
        status: 'active',
      });
      await post(alice, acmeId, '/unit-templates', body).expect(200);
      const taken = await post(alice, acmeId, '/unit-templates', {
        ...body,
        label: 'sac de 25 KG',
        clientOperationId: randomUUID(),
      }).expect(409);
      expect(taken.body.error.code).toBe('NAME_TAKEN');
      // Pieces are whole.
      await post(alice, acmeId, '/unit-templates', {
        label: 'Demi-pack',
        stockUnit: 'piece',
        factor: 2.5,
        clientOperationId: randomUUID(),
      }).expect(400);
      // Sellers read them, managers manage them.
      expect(
        (await get(carol, acmeId, '/unit-templates').expect(200)).body.map(
          (t: { id: string }) => t.id,
        ),
      ).toEqual([created.body.id]);
      await post(carol, acmeId, '/unit-templates', {
        ...body,
        label: 'Autre',
        clientOperationId: randomUUID(),
      }).expect(403);
      // Another shop neither sees nor changes them.
      expect(
        (await get(bob, globexId, '/unit-templates').expect(200)).body,
      ).toEqual([]);
      await patch(bob, globexId, `/unit-templates/${created.body.id}`, {
        status: 'archived',
      }).expect(404);
      // The cap lives in the database.
      await ctx.admin.query(
        `update app.organizations set max_unit_templates = 1 where id = $1`,
        [acmeId],
      );
      const capped = await post(alice, acmeId, '/unit-templates', {
        ...body,
        label: 'Carton de 12',
        clientOperationId: randomUUID(),
      }).expect(409);
      expect(capped.body.error.code).toBe('CATALOG_LIMIT_REACHED');
      await ctx.admin.query(
        `update app.organizations set max_unit_templates = 50 where id = $1`,
        [acmeId],
      );
      await patch(alice, acmeId, `/unit-templates/${created.body.id}`, {
        status: 'archived',
      }).expect(200);
      expect(
        (await get(alice, acmeId, '/unit-templates').expect(200)).body,
      ).toEqual([]);
    });

    it('lets the shop set its negotiation rules', async () => {
      const settings = (
        await get(alice, acmeId, '/notifications/settings').expect(200)
      ).body;
      expect(settings.sellerCanSellBelowCost).toBe(false);
      await patch(alice, acmeId, '/notifications/settings', {
        sellerCanSellBelowCost: true,
      }).expect(200);
      expect(
        (await get(alice, acmeId, '/notifications/settings').expect(200)).body
          .sellerCanSellBelowCost,
      ).toBe(true);
      await patch(carol, acmeId, '/notifications/settings', {
        sellerCanSellBelowCost: false,
      }).expect(403);
      await patch(alice, acmeId, '/notifications/settings', {
        sellerCanSellBelowCost: false,
      }).expect(200);
      // Each person reads their own limit with their shops.
      await patch(alice, acmeId, `/organizations/current/members/${carol.id}`, {
        maxDiscountBasisPoints: 1500,
      }).expect(200);
      const me = (
        await ctx
          .http()
          .get('/api/v1/me')
          .set({ Authorization: `Bearer ${carol.token}` })
          .expect(200)
      ).body;
      expect(
        me.organizations.find((o: { id: string }) => o.id === acmeId),
      ).toMatchObject({ role: 'member', maxDiscountBasisPoints: 1500 });
      await patch(alice, acmeId, `/organizations/current/members/${carol.id}`, {
        maxDiscountBasisPoints: null,
      }).expect(200);
    });
  });
});
