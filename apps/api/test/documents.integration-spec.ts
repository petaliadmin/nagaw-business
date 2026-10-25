import { randomUUID } from 'node:crypto';
import type { TestContext, TestUser } from './support/app.js';
import { createTestContext } from './support/app.js';

describe('Quotes, invoices and credit notes', () => {
  let ctx: TestContext;
  let alice: TestUser; // owner of Acme
  let bob: TestUser; // owner of Globex
  let carol: TestUser; // seller (member) of Acme
  let dan: TestUser; // reader (viewer) of Acme
  let acmeId: string;
  let globexId: string;
  let water: { id: string }; // 500 F, tax 18 %
  let customer: { id: string };
  let globexCustomer: { id: string };
  let year: string;

  const as = (user: TestUser, orgId: string) => ({
    Authorization: `Bearer ${user.token}`,
    'X-Organization-Id': orgId,
  });
  const get = (user: TestUser, orgId: string, path: string) =>
    ctx.http().get(`/api/v1${path}`).set(as(user, orgId));
  const post = (
    user: TestUser,
    orgId: string,
    path: string,
    body: object = {},
  ) => ctx.http().post(`/api/v1${path}`).set(as(user, orgId)).send(body);
  const put = (user: TestUser, orgId: string, path: string, body: object) =>
    ctx.http().put(`/api/v1${path}`).set(as(user, orgId)).send(body);

  const waterLine = (quantity = 2) => ({
    productId: water.id,
    label: 'Eau 1,5 L',
    unit: 'bouteille',
    quantity,
    unitPrice: 500,
    taxRateBasisPoints: 1800,
  });
  const serviceLine = {
    label: 'Livraison à domicile',
    unit: 'piece',
    quantity: 1,
    unitPrice: 1500,
  };
  const draftInvoice = (body: object = {}, user = alice, orgId = acmeId) =>
    post(user, orgId, '/invoices', {
      customerId: customer.id,
      lines: [waterLine(), serviceLine],
      clientOperationId: randomUUID(),
      ...body,
    });
  const issuedInvoice = async () => {
    const draft = (await draftInvoice().expect(201)).body;
    return (
      await post(alice, acmeId, `/invoices/${draft.id}/issue`).expect(200)
    ).body;
  };
  const pay = (id: string, amount: number, body: object = {}) =>
    post(alice, acmeId, `/invoices/${id}/payments`, {
      method: 'cash',
      amount,
      paidOn: `${year}-01-15`,
      clientOperationId: randomUUID(),
      ...body,
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
          .set({ Authorization: `Bearer ${user.token}` })
          .send({ name })
          .expect(201)
      ).body.id as string;
    acmeId = await createOrg(alice, 'Acme Dakar');
    globexId = await createOrg(bob, 'Globex');
    await ctx.admin.query(
      `insert into app.organization_memberships (organization_id, user_id, role)
       values ($1, $2, 'member'), ($1, $3, 'viewer')`,
      [acmeId, carol.id, dan.id],
    );
    const tax = (
      await post(alice, acmeId, '/tax-rates', {
        name: 'TVA',
        rateBasisPoints: 1800,
      }).expect(201)
    ).body;
    water = (
      await post(alice, acmeId, '/products', {
        name: 'Eau 1,5 L',
        unit: 'bouteille',
        salePrice: 500,
        categoryId: null,
        purchasePrice: null,
        taxRateId: tax.id,
        barcode: null,
        lowStockThreshold: null,
        trackStock: true,
        initialStock: 50,
        clientOperationId: randomUUID(),
      }).expect(201)
    ).body;
    const newCustomer = async (user: TestUser, orgId: string, name: string) =>
      (
        await post(user, orgId, '/customers', {
          name,
          address: 'Rue 10, Médina, Dakar',
          taxId: '0012345 2G3',
          clientOperationId: randomUUID(),
        }).expect(201)
      ).body;
    customer = await newCustomer(alice, acmeId, 'Awa Diop');
    globexCustomer = await newCustomer(bob, globexId, 'Client Globex');
    await ctx
      .http()
      .patch('/api/v1/organizations/current')
      .set(as(alice, acmeId))
      .send({
        legalName: 'Acme Dakar SARL',
        taxId: '0098765 2V2',
        invoiceDueDays: 15,
      })
      .expect(200);
    year = String(new Date().getUTCFullYear());
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('quotes', () => {
    it('numbers a quote, prices it with the tax detailed and answers a replay', async () => {
      const clientOperationId = randomUUID();
      const body = {
        customerId: customer.id,
        lines: [waterLine(3), serviceLine],
        discount: 500,
        clientOperationId,
      };
      const res = await post(alice, acmeId, '/quotes', body).expect(201);
      expect(res.body).toMatchObject({
        number: `D-${year}-0001`,
        status: 'draft',
        expired: false,
        customer: { name: 'Awa Diop', taxId: '0012345 2G3' },
        invoice: null,
      });
      // 3 × 500 + 1 500 − 500; the 18 % tax is included in the water.
      expect(res.body.totals).toMatchObject({
        subtotal: 3000,
        discount: 500,
        total: 2500,
      });
      expect(res.body.totals.taxTotal).toBeGreaterThan(0);
      expect(res.body.totals.totalExcludingTax).toBe(
        2500 - res.body.totals.taxTotal,
      );
      expect(
        res.body.lines.map((l: { lineTotal: number }) => l.lineTotal),
      ).toEqual([1500, 1500]);
      // Valid 30 days by default (the shop's setting).
      const days =
        (Date.parse(res.body.validUntil) - Date.parse(res.body.issueDate)) /
        86_400_000;
      expect(days).toBe(30);

      const replay = await post(alice, acmeId, '/quotes', body).expect(200);
      expect(replay.body.id).toBe(res.body.id);
      const next = await post(alice, acmeId, '/quotes', {
        ...body,
        clientOperationId: randomUUID(),
      }).expect(201);
      expect(next.body.number).toBe(`D-${year}-0002`);
    });

    it('edits a draft only, then turns an accepted quote into one invoice', async () => {
      const quote = (
        await post(alice, acmeId, '/quotes', {
          customerId: customer.id,
          lines: [serviceLine],
          clientOperationId: randomUUID(),
        }).expect(201)
      ).body;
      const edited = await put(alice, acmeId, `/quotes/${quote.id}`, {
        customerId: customer.id,
        lines: [serviceLine, waterLine(1)],
        validUntil: quote.validUntil,
        notes: 'Livraison sous 48 h',
      }).expect(200);
      expect(edited.body.totals.total).toBe(2000);
      await put(alice, acmeId, `/quotes/${quote.id}`, {
        customerId: customer.id,
        lines: [serviceLine],
        validUntil: '2020-01-01',
      }).expect(400); // before the quote's own date

      await post(alice, acmeId, `/quotes/${quote.id}/invoice`, {
        clientOperationId: randomUUID(),
      }).expect(409); // not accepted yet
      await post(alice, acmeId, `/quotes/${quote.id}/status`, {
        status: 'sent',
      }).expect(200);
      await put(alice, acmeId, `/quotes/${quote.id}`, {
        customerId: customer.id,
        lines: [serviceLine],
        validUntil: quote.validUntil,
      }).expect(409);
      await post(alice, acmeId, `/quotes/${quote.id}/status`, {
        status: 'sent',
      }).expect(409);
      await post(alice, acmeId, `/quotes/${quote.id}/status`, {
        status: 'accepted',
      }).expect(200);

      const clientOperationId = randomUUID();
      const invoice = await post(alice, acmeId, `/quotes/${quote.id}/invoice`, {
        clientOperationId,
      }).expect(201);
      expect(invoice.body).toMatchObject({
        kind: 'invoice',
        status: 'draft',
        number: null,
        quote: { id: quote.id, number: quote.number },
        notes: 'Livraison sous 48 h',
      });
      expect(invoice.body.totals.total).toBe(2000);
      await post(alice, acmeId, `/quotes/${quote.id}/invoice`, {
        clientOperationId,
      }).expect(200);
      await post(alice, acmeId, `/quotes/${quote.id}/invoice`, {
        clientOperationId: randomUUID(),
      }).expect(409);
      expect(
        (await get(alice, acmeId, `/quotes/${quote.id}`).expect(200)).body
          .invoice,
      ).toEqual({
        id: invoice.body.id,
        number: null,
      });
    });

    it('refuses a past validity, unknown products and a discount above the amount', async () => {
      const base = {
        customerId: customer.id,
        lines: [serviceLine],
        clientOperationId: randomUUID(),
      };
      await post(alice, acmeId, '/quotes', {
        ...base,
        validUntil: '2020-01-01',
      }).expect(400);
      await post(alice, acmeId, '/quotes', { ...base, discount: 5000 }).expect(
        400,
      );
      await post(alice, acmeId, '/quotes', {
        ...base,
        lines: [{ ...serviceLine, productId: randomUUID() }],
      }).expect(400);
      await post(alice, acmeId, '/quotes', {
        ...base,
        lines: [{ ...waterLine(), quantity: 1.5 }],
      }).expect(400); // bottles are counted whole
      await post(alice, acmeId, '/quotes', { ...base, lines: [] }).expect(400);
    });
  });

  describe('invoices', () => {
    it('numbers an invoice at issue, without gap, and never changes it afterwards', async () => {
      const draft = (await draftInvoice().expect(201)).body;
      expect(draft).toMatchObject({
        number: null,
        status: 'draft',
        issueDate: null,
      });
      const edited = await put(alice, acmeId, `/invoices/${draft.id}`, {
        customerId: customer.id,
        lines: [waterLine(4)],
        notes: 'Commande du 12',
      }).expect(200);
      expect(edited.body.totals.total).toBe(2000);

      const issued = (
        await post(alice, acmeId, `/invoices/${draft.id}/issue`).expect(200)
      ).body;
      expect(issued.number).toMatch(new RegExp(`^F-${year}-\\d{4}$`));
      expect(issued).toMatchObject({
        status: 'issued',
        paymentState: 'unpaid',
        balance: 2000,
      });
      // Payment term of the shop: 15 days.
      expect(
        (Date.parse(issued.dueDate) - Date.parse(issued.issueDate)) /
          86_400_000,
      ).toBe(15);
      await post(alice, acmeId, `/invoices/${draft.id}/issue`).expect(409);
      await put(alice, acmeId, `/invoices/${draft.id}`, {
        customerId: customer.id,
        lines: [waterLine(1)],
      }).expect(409);

      const next = await issuedInvoice();
      const n = (number: string) => Number(number.split('-')[2]);
      expect(n(next.number)).toBe(n(issued.number) + 1);
    });

    it('records partial payments up to the balance, then shows the invoice as paid', async () => {
      const invoice = await issuedInvoice(); // 2 × 500 + 1 500 = 2 500
      const first = await pay(invoice.id, 1000).expect(201);
      expect(first.body).toMatchObject({
        paid: 1000,
        balance: 1500,
        paymentState: 'partially_paid',
      });
      await pay(invoice.id, 2000).expect(409); // above what remains
      await pay(invoice.id, 500, { method: 'mobile_money' }).expect(400); // operator missing
      const clientOperationId = randomUUID();
      const last = await pay(invoice.id, 1500, {
        method: 'mobile_money',
        provider: 'wave',
        reference: 'TX-778',
        clientOperationId,
      }).expect(201);
      expect(last.body).toMatchObject({
        paid: 2500,
        balance: 0,
        paymentState: 'paid',
      });
      expect(last.body.payments).toHaveLength(2);
      await pay(invoice.id, 1500, {
        method: 'mobile_money',
        provider: 'wave',
        clientOperationId,
      }).expect(200);
      expect(
        (await get(alice, acmeId, `/invoices/${invoice.id}`).expect(200)).body
          .payments,
      ).toHaveLength(2);
      await pay(invoice.id, 1).expect(409);

      const draft = (await draftInvoice().expect(201)).body;
      await pay(draft.id, 100).expect(409); // a draft is not owed yet
    });

    it('cancels an unpaid invoice by a credit note, once', async () => {
      const invoice = await issuedInvoice();
      await post(alice, acmeId, `/invoices/${invoice.id}/cancel`, {
        reason: '',
        clientOperationId: randomUUID(),
      }).expect(400);
      const cancelled = await post(
        alice,
        acmeId,
        `/invoices/${invoice.id}/cancel`,
        {
          reason: 'Erreur de client',
          clientOperationId: randomUUID(),
        },
      ).expect(200);
      expect(cancelled.body).toMatchObject({
        status: 'cancelled',
        balance: 0,
        cancellation: { reason: 'Erreur de client' },
      });
      expect(cancelled.body.creditNote.number).toMatch(
        new RegExp(`^A-${year}-\\d{4}$`),
      );
      const creditNote = (
        await get(
          alice,
          acmeId,
          `/invoices/${cancelled.body.creditNote.id}`,
        ).expect(200)
      ).body;
      expect(creditNote).toMatchObject({
        kind: 'credit_note',
        status: 'issued',
        creditFor: { id: invoice.id, number: invoice.number },
      });
      expect(creditNote.totals.total).toBe(invoice.totals.total);
      await post(alice, acmeId, `/invoices/${invoice.id}/cancel`, {
        reason: 'Encore',
        clientOperationId: randomUUID(),
      }).expect(409);
      await pay(invoice.id, 100).expect(409);
      await pay(creditNote.id, 100).expect(409);

      const paid = await issuedInvoice();
      await pay(paid.id, 100).expect(201);
      await post(alice, acmeId, `/invoices/${paid.id}/cancel`, {
        reason: 'Retour',
        clientOperationId: randomUUID(),
      }).expect(409); // payments received: refund first

      const list = (await get(alice, acmeId, '/invoices').expect(200)).body;
      expect(
        list.find((d: { id: string }) => d.id === creditNote.id),
      ).toMatchObject({
        kind: 'credit_note',
        paymentState: null,
      });
    });

    it('invoices a sale paid at the counter, already settled, once', async () => {
      const sale = (
        await post(alice, acmeId, '/sales', {
          lines: [{ productId: water.id, quantity: 3 }],
          payments: [
            { method: 'cash', amount: 1000 },
            { method: 'mobile_money', provider: 'orange_money', amount: 500 },
          ],
          expectedTotal: 1500,
          clientOperationId: randomUUID(),
        }).expect(201)
      ).body;
      await post(alice, acmeId, `/invoices/from-sale/${sale.id}`, {
        clientOperationId: randomUUID(),
      }).expect(400); // no customer on the sale: one must be chosen
      const draft = (
        await post(alice, acmeId, `/invoices/from-sale/${sale.id}`, {
          customerId: customer.id,
          clientOperationId: randomUUID(),
        }).expect(201)
      ).body;
      expect(draft).toMatchObject({
        sale: { id: sale.id, saleNumber: sale.saleNumber },
      });
      expect(draft.totals.total).toBe(1500);
      expect(draft.lines[0]).toMatchObject({
        productId: water.id,
        quantity: 3,
        unitPrice: 500,
      });
      await post(alice, acmeId, `/invoices/from-sale/${sale.id}`, {
        customerId: customer.id,
        clientOperationId: randomUUID(),
      }).expect(409);
      const issued = (
        await post(alice, acmeId, `/invoices/${draft.id}/issue`).expect(200)
      ).body;
      expect(issued).toMatchObject({ paymentState: 'paid', balance: 0 });
      expect(
        issued.payments.map((p: { method: string; fromSale: boolean }) => [
          p.method,
          p.fromSale,
        ]),
      ).toEqual([
        ['cash', true],
        ['mobile_money', true],
      ]);

      const creditSale = (
        await post(alice, acmeId, '/sales', {
          customerId: customer.id,
          lines: [{ productId: water.id, quantity: 1 }],
          payments: [{ method: 'credit', amount: 500 }],
          expectedTotal: 500,
          clientOperationId: randomUUID(),
        }).expect(201)
      ).body;
      await post(alice, acmeId, `/invoices/from-sale/${creditSale.id}`, {
        clientOperationId: randomUUID(),
      }).expect(409);

      // A sale cancelled after its draft was made is not invoiced.
      const later = (
        await post(alice, acmeId, '/sales', {
          lines: [{ productId: water.id, quantity: 1 }],
          payments: [{ method: 'cash', amount: 500 }],
          expectedTotal: 500,
          clientOperationId: randomUUID(),
        }).expect(201)
      ).body;
      const laterDraft = (
        await post(alice, acmeId, `/invoices/from-sale/${later.id}`, {
          customerId: customer.id,
          clientOperationId: randomUUID(),
        }).expect(201)
      ).body;
      await post(alice, acmeId, `/sales/${later.id}/cancel`, {
        reason: 'Erreur',
      }).expect(200);
      await post(alice, acmeId, `/invoices/${laterDraft.id}/issue`).expect(409);
    });

    it('renders quotes and invoices as PDF', async () => {
      const invoice = await issuedInvoice();
      const res = await get(alice, acmeId, `/invoices/${invoice.id}/pdf`)
        .buffer(true)
        .parse((response, done) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('end', () => done(null, Buffer.concat(chunks)));
        })
        .expect(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toContain(
        `${invoice.number}.pdf`,
      );
      expect((res.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
      const quotes = (await get(alice, acmeId, '/quotes').expect(200)).body;
      await get(dan, acmeId, `/quotes/${quotes[0].id}/pdf`).expect(200);
      const draft = (await draftInvoice().expect(201)).body;
      await get(alice, acmeId, `/invoices/${draft.id}/pdf`).expect(200);
    });

    it('prints the shop identity it is given', async () => {
      const shop = (await get(dan, acmeId, '/documents/shop').expect(200)).body;
      expect(shop).toMatchObject({
        legalName: 'Acme Dakar SARL',
        taxId: '0098765 2V2',
        invoiceDueDays: 15,
      });
    });
  });

  describe('roles', () => {
    it('lets the reader read, and keeps documents to managers', async () => {
      expect(
        (await get(dan, acmeId, '/invoices').expect(200)).body.length,
      ).toBeGreaterThan(0);
      await draftInvoice({}, dan).expect(403);
      await draftInvoice({}, carol).expect(403);
      await get(carol, acmeId, '/invoices').expect(403);
      const invoice = await issuedInvoice();
      await post(dan, acmeId, `/invoices/${invoice.id}/payments`, {
        method: 'cash',
        amount: 100,
        paidOn: `${year}-01-15`,
        clientOperationId: randomUUID(),
      }).expect(403);
    });
  });

  describe('isolation between shops', () => {
    it('never shows nor touches the documents of another shop', async () => {
      const invoice = await issuedInvoice();
      const draft = (await draftInvoice().expect(201)).body;
      const quote = (await get(alice, acmeId, '/quotes').expect(200)).body[0];
      for (const path of [
        `/invoices/${invoice.id}`,
        `/invoices/${invoice.id}/pdf`,
        `/quotes/${quote.id}`,
        `/quotes/${quote.id}/pdf`,
      ])
        await get(bob, globexId, path).expect(404);
      await post(bob, globexId, `/invoices/${draft.id}/issue`).expect(404);
      await put(bob, globexId, `/invoices/${draft.id}`, {
        customerId: globexCustomer.id,
        lines: [serviceLine],
      }).expect(404);
      await post(bob, globexId, `/invoices/${invoice.id}/payments`, {
        method: 'cash',
        amount: 100,
        paidOn: `${year}-01-15`,
        clientOperationId: randomUUID(),
      }).expect(404);
      await post(bob, globexId, `/invoices/${invoice.id}/cancel`, {
        reason: 'x',
        clientOperationId: randomUUID(),
      }).expect(404);
      await post(bob, globexId, `/quotes/${quote.id}/status`, {
        status: 'refused',
      }).expect(404);
      await post(bob, globexId, `/quotes/${quote.id}/invoice`, {
        clientOperationId: randomUUID(),
      }).expect(404);
      expect((await get(bob, globexId, '/invoices').expect(200)).body).toEqual(
        [],
      );
      expect((await get(bob, globexId, '/quotes').expect(200)).body).toEqual(
        [],
      );

      // Nor uses its customers, products or sales.
      await draftInvoice({}, bob, globexId).expect(400); // Acme's customer
      await draftInvoice(
        { customerId: globexCustomer.id, lines: [waterLine()] },
        bob,
        globexId,
      ).expect(400); // Acme's product
      const sale = (
        await post(alice, acmeId, '/sales', {
          lines: [{ productId: water.id, quantity: 1 }],
          payments: [{ method: 'cash', amount: 500 }],
          expectedTotal: 500,
          clientOperationId: randomUUID(),
        }).expect(201)
      ).body;
      await post(bob, globexId, `/invoices/from-sale/${sale.id}`, {
        customerId: globexCustomer.id,
        clientOperationId: randomUUID(),
      }).expect(404);

      // Each shop has its own numbering.
      const globexInvoice = (
        await draftInvoice(
          { customerId: globexCustomer.id, lines: [serviceLine] },
          bob,
          globexId,
        ).expect(201)
      ).body;
      const issued = await post(
        bob,
        globexId,
        `/invoices/${globexInvoice.id}/issue`,
      ).expect(200);
      expect(issued.body.number).toBe(`F-${year}-0001`);
    });
  });

  describe('database guarantees', () => {
    it('keeps an issued invoice final and its payments append-only, even in SQL', async () => {
      const invoice = await issuedInvoice();
      await pay(invoice.id, 100).expect(201);
      await expect(
        ctx.admin.query(
          'update app.invoices set total = 1, subtotal = 1 where id = $1',
          [invoice.id],
        ),
      ).rejects.toThrow(/only be cancelled/);
      await expect(
        ctx.admin.query('delete from app.invoices where id = $1', [invoice.id]),
      ).rejects.toThrow();
      await expect(
        ctx.admin.query(
          `update app.invoices set status = 'cancelled' where id = $1`,
          [invoice.id],
        ),
      ).rejects.toThrow(); // who, when and why
      await expect(
        ctx.admin.query(
          'update app.invoice_payments set amount = 1 where invoice_id = $1',
          [invoice.id],
        ),
      ).rejects.toThrow(/append-only/);
      await expect(
        ctx.admin.query(
          'delete from app.invoice_payments where invoice_id = $1',
          [invoice.id],
        ),
      ).rejects.toThrow(/append-only/);
    });
  });
});
