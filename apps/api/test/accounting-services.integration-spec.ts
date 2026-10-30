import { randomUUID } from 'node:crypto';
import type { TestContext, TestUser } from './support/app.js';
import { createTestContext } from './support/app.js';

interface Entry {
  kind: string;
  voucher: string;
  account: { code: string };
  receipt: number;
  expense: number;
}

/** Receipts between 701 and 706 (ADR-046), in a shop selling both. */
describe('Accounts of goods and services', () => {
  let ctx: TestContext;
  let alice: TestUser;
  let bob: TestUser;
  let shopId: string;
  let otherId: string;
  let soap: { id: string }; // 1 000 F, goods
  let haircut: { id: string }; // 3 000 F, service
  let customer: { id: string };
  let day: string;

  const as = (user: TestUser, orgId: string) => ({
    Authorization: `Bearer ${user.token}`,
    'X-Organization-Id': orgId,
  });
  const get = (user: TestUser, orgId: string, path: string) =>
    ctx.http().get(`/api/v1${path}`).set(as(user, orgId));
  const post = (user: TestUser, orgId: string, path: string, body: object) =>
    ctx.http().post(`/api/v1${path}`).set(as(user, orgId)).send(body);

  const item = async (fields: object) =>
    (
      await post(alice, shopId, '/products', {
        categoryId: null,
        purchasePrice: null,
        taxRateId: null,
        barcode: null,
        lowStockThreshold: null,
        trackStock: false,
        clientOperationId: randomUUID(),
        ...fields,
      }).expect(201)
    ).body;
  const sell = (lines: object[], payments: object[], total: number) =>
    post(alice, shopId, '/sales', {
      clientOperationId: randomUUID(),
      customerId: customer.id,
      lines,
      payments,
      expectedTotal: total,
    });
  const journal = async () =>
    (
      await get(
        alice,
        shopId,
        `/accounting/journal?from=${day}&to=${day}`,
      ).expect(200)
    ).body.entries as Entry[];

  beforeAll(async () => {
    ctx = await createTestContext();
    [alice, bob] = await Promise.all([ctx.createUser(), ctx.createUser()]);
    const shop = async (user: TestUser, name: string) =>
      (
        await ctx
          .http()
          .post('/api/v1/organizations')
          .set({ Authorization: `Bearer ${user.token}` })
          .send({ name, timezone: 'Africa/Dakar' })
          .expect(201)
      ).body.id as string;
    shopId = await shop(alice, 'Salon Awa');
    otherId = await shop(bob, 'Autre');
    soap = await item({ name: 'Savon', unit: 'piece', salePrice: 1000 });
    haircut = await item({
      kind: 'service',
      name: 'Coupe',
      unit: 'prestation',
      salePrice: 3000,
    });
    customer = (
      await post(alice, shopId, '/customers', {
        name: 'Fatou',
        clientOperationId: randomUUID(),
      }).expect(201)
    ).body;
    day = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Dakar',
    }).format(new Date());

    // Mixed sale, paid in two parts; a credit sale of a service, repaid.
    await sell(
      [
        { productId: soap.id, quantity: 1 },
        { productId: haircut.id, quantity: 1 },
      ],
      [
        { method: 'cash', amount: 2000 },
        { method: 'card', amount: 2000 },
      ],
      4000,
    ).expect(201);
    await sell(
      [{ productId: haircut.id, quantity: 1 }],
      [{ method: 'credit', amount: 3000 }],
      3000,
    ).expect(201);
    await post(alice, shopId, `/customers/${customer.id}/payments`, {
      method: 'cash',
      amount: 1000,
      clientOperationId: randomUUID(),
    }).expect(201);

    // An invoice of a catalogue product and a free line.
    const draft = (
      await post(alice, shopId, '/invoices', {
        customerId: customer.id,
        lines: [
          {
            productId: soap.id,
            label: 'Savon',
            unit: 'piece',
            quantity: 1,
            unitPrice: 1000,
          },
          { label: 'Déplacement', unit: 'piece', quantity: 1, unitPrice: 3000 },
        ],
        clientOperationId: randomUUID(),
      }).expect(201)
    ).body;
    await post(alice, shopId, `/invoices/${draft.id}/issue`, {}).expect(200);
    await post(alice, shopId, `/invoices/${draft.id}/payments`, {
      method: 'cash',
      amount: 4000,
      paidOn: day,
      clientOperationId: randomUUID(),
    }).expect(201);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('splits each receipt of a sale in proportion of what was sold', async () => {
    const sale = (await journal()).filter((e) => e.kind === 'sale');
    const on = (code: string) =>
      sale
        .filter((e) => e.account.code === code)
        .map((e) => e.receipt)
        .sort();
    expect(on('701')).toEqual([500, 500]);
    expect(on('706')).toEqual([1500, 1500]);
    expect(on('70')).toEqual([]);
  });

  it('books a repayment like the credit sales of the customer', async () => {
    const repaid = (await journal()).filter((e) => e.kind === 'repayment');
    expect(repaid.map((e) => [e.account.code, e.receipt])).toEqual([
      ['706', 1000],
    ]);
  });

  it('books a free line of an invoice as a service', async () => {
    const paid = (await journal()).filter((e) => e.kind === 'invoice_payment');
    expect(paid.map((e) => [e.account.code, e.receipt]).sort()).toEqual([
      ['701', 1000],
      ['706', 3000],
    ]);
  });

  it('gives the same figures in the journal and in the statement', async () => {
    const year = Number(day.slice(0, 4));
    const statement = (
      await get(alice, shopId, `/accounting/statement?year=${year}`).expect(200)
    ).body;
    expect(statement.receipts).toEqual([
      { code: '701', label: 'Ventes de marchandises', amount: 2000 },
      { code: '706', label: 'Services vendus', amount: 7000 },
    ]);
    const entries = await journal();
    expect(entries.reduce((sum, e) => sum + e.receipt, 0)).toBe(9000);
    expect(statement.totals.receipts).toBe(9000);
  });

  it('takes back a cancelled sale from the same accounts', async () => {
    const sale = (
      await sell(
        [
          { productId: soap.id, quantity: 1 },
          { productId: haircut.id, quantity: 1 },
        ],
        [{ method: 'cash', amount: 4000 }],
        4000,
      ).expect(201)
    ).body;
    await post(alice, shopId, `/sales/${sale.id}/cancel`, {
      reason: 'Erreur',
    }).expect(200);
    const taken = (await journal())
      .filter((e) => e.kind === 'sale_cancelled')
      .map((e) => [e.account.code, e.expense])
      .sort();
    expect(taken).toEqual([
      ['701', 1000],
      ['706', 3000],
    ]);
  });

  it('shows nothing of it to another shop', async () => {
    const theirs = (
      await get(
        bob,
        otherId,
        `/accounting/journal?from=${day}&to=${day}`,
      ).expect(200)
    ).body;
    expect(theirs.entries).toEqual([]);
    await get(bob, shopId, `/accounting/journal?from=${day}&to=${day}`).expect(
      404,
    );
  });
});
