import { describe, expect, it } from 'vitest';
import { roleHasPermission } from './permissions.js';
import {
  computeSaleTotals,
  createSaleSchema,
  describeSaleLine,
  formatSoldQuantity,
  paymentProblem,
  paymentSchema,
  reductionBasisPoints,
} from './sales.js';

const OP = '6f1c1b2e-5d7a-4c3e-9f10-2b3c4d5e6f70';
const PRODUCT = '7a1c1b2e-5d7a-4c3e-9f10-2b3c4d5e6f71';

describe('sale totals', () => {
  it('adds lines, rounding weights to the currency unit', () => {
    const totals = computeSaleTotals(
      [
        { unitPrice: 500, quantity: 3, taxRateBasisPoints: null },
        { unitPrice: 1250, quantity: 0.75, taxRateBasisPoints: null },
      ],
      0,
    );
    expect(totals.lines.map((l) => l.lineTotal)).toEqual([1500, 938]);
    expect(totals).toMatchObject({
      subtotal: 2438,
      discount: 0,
      total: 2438,
      taxTotal: 0,
    });
  });

  it('extracts the tax included in the price, after the discount', () => {
    // 11 800 TTC at 18 % includes 1 800 of tax.
    expect(
      computeSaleTotals(
        [{ unitPrice: 11800, quantity: 1, taxRateBasisPoints: 1800 }],
        0,
      ).taxTotal,
    ).toBe(1800);
    // A 1 180 discount leaves 10 620 paid, which includes 1 620.
    const discounted = computeSaleTotals(
      [{ unitPrice: 11800, quantity: 1, taxRateBasisPoints: 1800 }],
      1180,
    );
    expect(discounted).toMatchObject({ total: 10620, taxTotal: 1620 });
  });

  it('spreads the discount over the lines without losing a franc', () => {
    const totals = computeSaleTotals(
      [
        { unitPrice: 1000, quantity: 1, taxRateBasisPoints: 1800 },
        { unitPrice: 2000, quantity: 1, taxRateBasisPoints: null },
        { unitPrice: 333, quantity: 1, taxRateBasisPoints: 1800 },
      ],
      100,
    );
    expect(totals.total).toBe(3233);
    expect(totals.discount).toBe(100);
  });

  it('never gives a discount larger than the sale', () => {
    expect(
      computeSaleTotals(
        [{ unitPrice: 500, quantity: 1, taxRateBasisPoints: null }],
        900,
      ),
    ).toMatchObject({ discount: 500, total: 0 });
  });
});

describe('payments', () => {
  const base = { total: 5000, cashReceived: null, customerId: null };

  it('must cover the total exactly', () => {
    expect(
      paymentProblem({ ...base, payments: [{ method: 'cash', amount: 4000 }] })
        ?.path,
    ).toBe('payments');
    expect(
      paymentProblem({
        ...base,
        payments: [
          { method: 'cash', amount: 3000 },
          { method: 'mobile_money', amount: 2000 },
        ],
      }),
    ).toBeNull();
  });

  it('accepts more cash than due (change), never less', () => {
    const cash = [{ method: 'cash' as const, amount: 5000 }];
    expect(
      paymentProblem({ ...base, payments: cash, cashReceived: 10000 }),
    ).toBeNull();
    expect(
      paymentProblem({ ...base, payments: cash, cashReceived: 4000 })?.path,
    ).toBe('cashReceived');
    expect(
      paymentProblem({
        ...base,
        payments: [{ method: 'card', amount: 5000 }],
        cashReceived: 5000,
      })?.path,
    ).toBe('cashReceived');
  });

  it('needs a customer for a sale on credit', () => {
    const credit = [{ method: 'credit' as const, amount: 5000 }];
    expect(paymentProblem({ ...base, payments: credit })?.path).toBe(
      'customerId',
    );
    expect(
      paymentProblem({ ...base, payments: credit, customerId: OP }),
    ).toBeNull();
  });

  it('asks the operator of a Mobile Money payment', () => {
    expect(
      paymentSchema.safeParse({ method: 'mobile_money', amount: 100 }).success,
    ).toBe(false);
    expect(
      paymentSchema.safeParse({
        method: 'mobile_money',
        amount: 100,
        provider: 'wave',
      }).success,
    ).toBe(true);
    expect(
      paymentSchema.safeParse({ method: 'cash', amount: 100, provider: 'wave' })
        .success,
    ).toBe(false);
  });

  it('refuses an empty cart and server-owned fields', () => {
    const sale = {
      clientOperationId: OP,
      lines: [{ productId: PRODUCT, quantity: 1 }],
      payments: [{ method: 'cash', amount: 500 }],
      expectedTotal: 500,
    };
    expect(createSaleSchema.safeParse(sale).success).toBe(true);
    expect(createSaleSchema.safeParse({ ...sale, lines: [] }).success).toBe(
      false,
    );
    expect(createSaleSchema.safeParse({ ...sale, total: 1 }).success).toBe(
      false,
    );
    expect(
      createSaleSchema.safeParse({
        ...sale,
        lines: [{ productId: PRODUCT, quantity: 1, unitPrice: 1 }],
      }).success,
    ).toBe(false);
  });
});

describe('sales permissions', () => {
  it('lets every role but the reader sell, and only managers cancel', () => {
    for (const role of ['owner', 'admin', 'member'] as const)
      expect(roleHasPermission(role, 'sales.create')).toBe(true);
    expect(roleHasPermission('viewer', 'sales.create')).toBe(false);
    for (const role of ['owner', 'admin'] as const)
      expect(roleHasPermission(role, 'sales.cancel')).toBe(true);
    for (const role of ['member', 'viewer'] as const)
      expect(roleHasPermission(role, 'sales.cancel')).toBe(false);
    expect(roleHasPermission('member', 'sales.read_all')).toBe(false);
    expect(roleHasPermission('viewer', 'sales.read_all')).toBe(true);
  });
});

describe('negotiated prices (ADR-038)', () => {
  it('keeps the catalogue amount and charges the agreed one', () => {
    const totals = computeSaleTotals(
      [
        {
          unitPrice: 30000,
          quantity: 2,
          taxRateBasisPoints: null,
          agreedTotal: 56000,
        },
        { unitPrice: 650, quantity: 1, taxRateBasisPoints: null },
      ],
      0,
    );
    expect(totals.lines.map((l) => [l.listTotal, l.lineTotal])).toEqual([
      [60000, 56000],
      [650, 650],
    ]);
    expect(totals).toMatchObject({
      listSubtotal: 60650,
      subtotal: 56650,
      total: 56650,
    });
  });

  it('shares the discount over the agreed amounts and taxes what is paid', () => {
    const totals = computeSaleTotals(
      [
        {
          unitPrice: 11800,
          quantity: 1,
          taxRateBasisPoints: 1800,
          agreedTotal: 10620,
        },
        { unitPrice: 1000, quantity: 1, taxRateBasisPoints: null },
      ],
      620,
    );
    expect(totals.total).toBe(11000);
    // 566 + 53, the remaining franc on the largest line.
    expect(totals.lines.map((l) => l.paid)).toEqual([10620 - 567, 1000 - 53]);
    expect(totals.lines[0]!.taxAmount).toBe(Math.round((10053 * 1800) / 11800));
  });

  it('sells « for 500 F »: the agreed amount fixes the line', () => {
    // 500 F of sugar at 650 F the kg: the device sends 0,769 kg for 500 F.
    const totals = computeSaleTotals(
      [
        {
          unitPrice: 650,
          quantity: 0.769,
          taxRateBasisPoints: null,
          agreedTotal: 500,
        },
      ],
      0,
    );
    expect(totals.lines[0]).toMatchObject({ listTotal: 500, lineTotal: 500 });
  });

  it('measures the reduction against the catalogue amount', () => {
    expect(reductionBasisPoints(10000, 9000)).toBe(1000);
    expect(reductionBasisPoints(3000, 2999)).toBe(4); // rounded up
    expect(reductionBasisPoints(10000, 10500)).toBe(0); // paid more
    expect(reductionBasisPoints(0, 0)).toBe(0);
  });

  it('accepts a selling unit and an agreed amount on a sale line', () => {
    const parsed = createSaleSchema.parse({
      clientOperationId: OP,
      lines: [{ productId: PRODUCT, quantity: 2 }],
      payments: [{ method: 'cash', amount: 1000 }],
      expectedTotal: 1000,
    });
    expect(parsed.lines[0]).toEqual({
      productId: PRODUCT,
      productUnitId: null,
      conversion: null,
      quantity: 2,
      agreedTotal: null,
    });
  });

  it('names the unit of a line and its price', () => {
    const money = (value: number) => `${value} F`;
    const sack = {
      quantity: 2,
      unit: 'kg' as const,
      unitLabel: 'sac de 50 kg',
      productUnitId: 'u1',
      priceBasis: 'unit' as const,
      unitPrice: 30000,
    };
    expect(formatSoldQuantity(sack)).toBe('2 × sac de 50 kg');
    expect(describeSaleLine(sack, money)).toBe('2 × sac de 50 kg × 30000 F');
    const grams = {
      quantity: 250,
      unit: 'kg' as const,
      unitLabel: 'g',
      productUnitId: null,
      priceBasis: 'stock' as const,
      unitPrice: 650,
    };
    expect(describeSaleLine(grams, money)).toBe('250 g à 650 F par kg');
    expect(
      formatSoldQuantity({
        quantity: 2,
        unit: 'kg',
        unitLabel: null,
        productUnitId: null,
      }),
    ).toBe('2 kg');
  });
});

describe('one unit per line', () => {
  it('refuses a selling unit and a conversion together', () => {
    const sale = (line: object) =>
      createSaleSchema.safeParse({
        clientOperationId: OP,
        lines: [{ productId: PRODUCT, quantity: 1, ...line }],
        payments: [{ method: 'cash', amount: 1 }],
        expectedTotal: 1,
      }).success;
    expect(sale({ conversion: 'g' })).toBe(true);
    expect(sale({ conversion: 'pouce' })).toBe(false);
    expect(sale({ conversion: 'g', productUnitId: PRODUCT })).toBe(false);
  });
});
