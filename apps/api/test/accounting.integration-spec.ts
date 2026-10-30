import { randomUUID } from 'node:crypto';
import type { TestContext, TestUser } from './support/app.js';
import { createTestContext } from './support/app.js';

const WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x1a, 0, 0, 0]),
  Buffer.from('WEBPVP8 '),
  Buffer.alloc(14, 1),
]);

interface Entry {
  voucher: string;
  label: string;
  kind: string;
  account: { code: string };
  cashAccount: { name: string; code: string };
  receipt: number;
  expense: number;
}

describe('Accounting (minimal cash system)', () => {
  let ctx: TestContext;
  let alice: TestUser; // owner of Acme
  let bob: TestUser; // owner of Globex
  let carol: TestUser; // seller (member) of Acme
  let dan: TestUser; // reader (viewer, the accountant) of Acme
  let acmeId: string;
  let globexId: string;
  let water: { id: string };
  let customer: { id: string };
  let day: string;
  let year: number;
  let rent: { id: string };
  let caisse: { id: string };
  let banque: { id: string };
  let saleNumbers: number[];
  let firstExpense: { id: string; number: string };

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
  const putReceipt = (
    id: string,
    data: Buffer,
    type: string,
    user = alice,
    orgId = acmeId,
  ) =>
    ctx
      .http()
      .put(`/api/v1/expenses/${id}/receipt`)
      .set(as(user, orgId))
      .set('Content-Type', type)
      .send(data);
  const binary = (request: ReturnType<typeof get>) =>
    request.buffer(true).parse((response, done) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => done(null, Buffer.concat(chunks)));
    });
  const expense = (label: string, amount: number, extra: object = {}) =>
    post(alice, acmeId, '/expenses', {
      categoryId: rent.id,
      cashAccountId: caisse.id,
      label,
      amount,
      occurredOn: day,
      clientOperationId: randomUUID(),
      ...extra,
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
    const product = async (fields: object) =>
      (
        await post(alice, acmeId, '/products', {
          categoryId: null,
          purchasePrice: null,
          taxRateId: null,
          barcode: null,
          lowStockThreshold: null,
          trackStock: true,
          clientOperationId: randomUUID(),
          ...fields,
        }).expect(201)
      ).body;
    water = await product({
      name: 'Eau',
      unit: 'bouteille',
      salePrice: 500,
      purchasePrice: 300,
      initialStock: 10,
    });
    await product({
      name: 'Savon',
      unit: 'piece',
      salePrice: 750,
      initialStock: 4,
    });
    customer = (
      await post(alice, acmeId, '/customers', {
        name: 'Awa Diop',
        clientOperationId: randomUUID(),
      }).expect(201)
    ).body;
    const treasury = (await get(alice, acmeId, '/treasury').expect(200)).body;
    day = treasury.today.day;
    year = Number(day.slice(0, 4));
    caisse = treasury.accounts.find(
      (a: { name: string }) => a.name === 'Caisse',
    );
    banque = treasury.accounts.find(
      (a: { name: string }) => a.name === 'Banque',
    );
    const categories = (
      await get(alice, acmeId, '/expense-categories').expect(200)
    ).body;
    rent = categories.find(
      (c: { accountCode: string }) => c.accountCode === '622',
    );

    // The day of the shop: three sales, a repayment, an invoice paid by
    // cheque, an expense, cash taken to the bank, a drawer short of 50.
    const sell = (payments: object[], quantity: number, extra: object = {}) =>
      post(alice, acmeId, '/sales', {
        lines: [{ productId: water.id, quantity }],
        payments,
        expectedTotal: 500 * quantity,
        clientOperationId: randomUUID(),
        ...extra,
      }).expect(201);
    saleNumbers = [
      (await sell([{ method: 'cash', amount: 500 }], 1)).body.saleNumber,
      (
        await sell(
          [{ method: 'mobile_money', provider: 'wave', amount: 500 }],
          1,
        )
      ).body.saleNumber,
      (
        await sell([{ method: 'credit', amount: 500 }], 1, {
          customerId: customer.id,
        })
      ).body.saleNumber,
    ];
    await post(alice, acmeId, `/customers/${customer.id}/payments`, {
      method: 'cash',
      amount: 200,
      clientOperationId: randomUUID(),
    }).expect(201);
    const invoice = (
      await post(alice, acmeId, '/invoices', {
        customerId: customer.id,
        lines: [
          { label: 'Livraison', unit: 'piece', quantity: 1, unitPrice: 1000 },
        ],
        clientOperationId: randomUUID(),
      }).expect(201)
    ).body;
    await post(alice, acmeId, `/invoices/${invoice.id}/issue`).expect(200);
    await post(alice, acmeId, `/invoices/${invoice.id}/payments`, {
      method: 'cheque',
      amount: 1000,
      paidOn: day,
      clientOperationId: randomUUID(),
    }).expect(201);
    firstExpense = (await expense('Loyer d’octobre', 300).expect(201)).body;
    await post(alice, acmeId, '/treasury/transfers', {
      fromAccountId: caisse.id,
      toAccountId: banque.id,
      amount: 100,
      occurredOn: day,
      clientOperationId: randomUUID(),
    }).expect(201);
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('expenses for the accountant', () => {
    it('numbers expenses by year, without gap', async () => {
      expect(firstExpense.number).toBe(`DEP-${year}-0001`);
      const second = (await expense('Loyer de novembre', 10).expect(201)).body;
      expect(second.number).toBe(`DEP-${year}-0002`);
      await post(alice, acmeId, `/expenses/${second.id}/cancel`, {
        reason: 'Doublon',
      }).expect(200);
      // A cancelled expense keeps its number: the next one follows.
      expect(
        (await expense('Ampoules', 20, { categoryId: rent.id }).expect(201))
          .body.number,
      ).toBe(`DEP-${year}-0003`);
      // Each shop has its own numbering.
      const globex = (await get(bob, globexId, '/treasury').expect(200)).body;
      const globexCategory = (
        await get(bob, globexId, '/expense-categories').expect(200)
      ).body[0];
      const theirs = await post(bob, globexId, '/expenses', {
        categoryId: globexCategory.id,
        cashAccountId: globex.accounts[0].id,
        label: 'Loyer',
        amount: 1,
        occurredOn: day,
        clientOperationId: randomUUID(),
      }).expect(201);
      expect(theirs.body.number).toBe(`DEP-${year}-0001`);
    });

    it('keeps a receipt photo with the expense', async () => {
      expect(
        (
          await get(alice, acmeId, `/expenses?from=${day}&to=${day}`).expect(
            200,
          )
        ).body[0].receiptVersion,
      ).toBeNull();
      await putReceipt(
        firstExpense.id,
        Buffer.from('pas une image'),
        'image/png',
      ).expect(400);
      await putReceipt(firstExpense.id, WEBP, 'image/png').expect(400); // declared type lies
      const saved = (
        await putReceipt(firstExpense.id, WEBP, 'image/webp').expect(200)
      ).body;
      expect(saved.receiptVersion).toMatch(/^[0-9a-f]{16}$/);
      const served = await binary(
        get(dan, acmeId, `/expenses/${firstExpense.id}/receipt`),
      ).expect(200);
      expect(served.headers['content-type']).toBe('image/webp');
      expect(Buffer.compare(served.body as Buffer, WEBP)).toBe(0);
      await putReceipt(firstExpense.id, WEBP, 'image/webp', dan).expect(403);
      await expect(
        ctx.admin.query(
          'delete from app.expense_receipts where expense_id = $1',
          [firstExpense.id],
        ),
      ).rejects.toThrow(/append-only/);
    });
  });

  describe('journal of receipts and expenses', () => {
    it('books every movement to its account and its cash account', async () => {
      // The drawer is counted 50 short.
      const expected = (
        await get(
          alice,
          acmeId,
          `/treasury/closings/expected?cashAccountId=${caisse.id}&day=${day}`,
        ).expect(200)
      ).body.expectedAmount;
      await post(alice, acmeId, '/treasury/closings', {
        cashAccountId: caisse.id,
        day,
        countedAmount: expected - 50,
        clientOperationId: randomUUID(),
      }).expect(201);

      const journal = (
        await get(
          dan,
          acmeId,
          `/accounting/journal?from=${day}&to=${day}`,
        ).expect(200)
      ).body;
      const entries = journal.entries as Entry[];
      const find = (kind: string, label?: RegExp) =>
        entries.filter(
          (e) => e.kind === kind && (!label || label.test(e.label)),
        );
      const ticket = (n: number) => `Ticket n° ${String(n).padStart(6, '0')}`;

      expect(find('sale')).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            voucher: ticket(saleNumbers[0]!),
            account: { code: '701', label: 'Ventes de marchandises' },
            cashAccount: expect.objectContaining({
              name: 'Caisse',
              code: '571',
            }),
            receipt: 500,
            expense: 0,
          }),
          expect.objectContaining({
            voucher: ticket(saleNumbers[1]!),
            cashAccount: expect.objectContaining({ name: 'Wave', code: '55' }),
            receipt: 500,
          }),
        ]),
      );
      // A sale on credit brings no money: only its repayment shows.
      expect(find('sale').map((e) => e.voucher)).not.toContain(
        ticket(saleNumbers[2]!),
      );
      expect(find('repayment')).toEqual([
        expect.objectContaining({
          label: 'Remboursement de Awa Diop',
          receipt: 200,
        }),
      ]);
      expect(find('invoice_payment')).toEqual([
        expect.objectContaining({
          voucher: `F-${year}-0001`,
          cashAccount: expect.objectContaining({ code: '521' }),
          receipt: 1000,
        }),
      ]);
      expect(find('expense', /octobre/)).toEqual([
        expect.objectContaining({
          voucher: `DEP-${year}-0001`,
          account: expect.objectContaining({ code: '622' }),
          expense: 300,
        }),
      ]);
      expect(find('expense', /novembre/)).toEqual([]); // cancelled
      expect(find('transfer_out')[0]).toMatchObject({
        account: { code: '585' },
        expense: 100,
        label: 'Envoyé vers Banque',
      });
      expect(find('transfer_in')[0]).toMatchObject({
        account: { code: '585' },
        receipt: 100,
        label: 'Reçu de Caisse',
      });
      expect(find('closing')[0]).toMatchObject({
        account: { code: '658' },
        expense: 50,
      });
      expect(journal.totals).toEqual({
        receipts: 500 + 500 + 200 + 1000 + 100,
        expenses: 300 + 20 + 100 + 50,
      });
      expect(journal.truncated).toBe(false);
    });

    it('exports the journal as CSV for a French spreadsheet', async () => {
      const res = await get(
        dan,
        acmeId,
        `/accounting/journal.csv?from=${day}&to=${day}`,
      ).expect(200);
      expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(res.headers['content-disposition']).toBe(
        `attachment; filename="journal-recettes-depenses-${day}-${day}.csv"`,
      );
      const text = res.text;
      expect(text.startsWith('﻿Date;Pièce;Libellé;Compte')).toBe(true);
      const frenchDay = day.split('-').reverse().join('/');
      expect(text).toContain(
        `${frenchDay};DEP-${year}-0001;Loyer d’octobre;622;`,
      );
      expect(text).toContain(';Caisse;571;;300\r\n');
    });
  });

  describe('end of year statement', () => {
    it('sums receipts and expenses by account, consistent with the treasury', async () => {
      const s = (
        await get(dan, acmeId, `/accounting/statement?year=${year}`).expect(200)
      ).body;
      expect(s).toMatchObject({
        year,
        from: `${year}-01-01`,
        to: day,
        provisional: day < `${year}-12-31`,
      });
      expect(s.receipts).toEqual([
        { code: '701', label: 'Ventes de marchandises', amount: 1200 },
        { code: '706', label: 'Services vendus', amount: 1000 },
      ]);
      expect(s.expenses).toEqual([
        { code: '622', label: 'Loyer', amount: 320 },
        {
          code: '658',
          label: 'Charges diverses (manquant de caisse)',
          amount: 50,
        },
      ]);
      expect(s.totals).toEqual({ receipts: 2200, expenses: 370, result: 1830 });
      // Transfers move money inside the shop: the treasury varies by the result.
      expect(s.treasury.end - s.treasury.start).toBe(s.totals.result);
      expect(
        s.treasury.accounts.find((a: { code: string }) => a.code === '521').end,
      ).toBe(1100);
      expect(s.receivables).toEqual({ customers: 300, invoices: 0 });
      // 7 bottles left at 300; the soap has no purchase price.
      expect(s.stock).toEqual({ value: 2100, unvaluedProducts: 1 });

      const csv = (
        await get(dan, acmeId, `/accounting/statement.csv?year=${year}`).expect(
          200,
        )
      ).text;
      expect(csv).toContain('Total des recettes;;2200\r\n');
      expect(csv).toContain('Résultat (recettes - dépenses);;1830\r\n');
      await get(dan, acmeId, `/accounting/statement?year=${year + 1}`).expect(
        400,
      );
      await get(dan, acmeId, '/accounting/statement?year=abc').expect(400);
      const past = (
        await get(dan, acmeId, `/accounting/statement?year=${year - 1}`).expect(
          200,
        )
      ).body;
      expect(past).toMatchObject({
        provisional: false,
        totals: { receipts: 0, expenses: 0, result: 0 },
      });
    });
  });

  describe('roles and isolation', () => {
    it('gives the accounts to managers and the accountant, not to sellers', async () => {
      await get(carol, acmeId, '/accounting/journal').expect(403);
      await get(carol, acmeId, `/accounting/statement?year=${year}`).expect(
        403,
      );
      await get(carol, acmeId, '/accounting/journal.csv').expect(403);
      await get(alice, acmeId, '/accounting/journal').expect(200);
    });

    it('never shows the accounts nor the receipts of another shop', async () => {
      const journal = (
        await get(
          bob,
          globexId,
          `/accounting/journal?from=${day}&to=${day}`,
        ).expect(200)
      ).body;
      expect(journal.entries.map((e: Entry) => e.label)).toEqual(['Loyer']);
      const statement = (
        await get(bob, globexId, `/accounting/statement?year=${year}`).expect(
          200,
        )
      ).body;
      expect(statement.totals).toEqual({
        receipts: 0,
        expenses: 1,
        result: -1,
      });
      expect(statement.stock).toEqual({ value: 0, unvaluedProducts: 0 });
      const csv = (
        await get(
          bob,
          globexId,
          `/accounting/journal.csv?from=${day}&to=${day}`,
        ).expect(200)
      ).text;
      expect(csv).not.toContain('octobre');
      await get(bob, globexId, `/expenses/${firstExpense.id}/receipt`).expect(
        404,
      );
      await putReceipt(
        firstExpense.id,
        WEBP,
        'image/webp',
        bob,
        globexId,
      ).expect(404);
    });
  });
});
