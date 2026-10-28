import type { ProductDto } from '@nagaw/shared';
import { describe, expect, it } from 'vitest';
import {
  negotiationProblem,
  priceCart,
  quantityError,
  quantityForAmount,
  totalsOf,
  wantedStock,
  type CartLine,
} from './cart';

const rice: ProductDto = {
  id: 'rice',
  name: 'Riz',
  category: null,
  unit: 'kg',
  salePrice: 650,
  purchasePrice: 500,
  taxRate: null,
  barcode: null,
  trackStock: true,
  lowStockThreshold: null,
  stockQuantity: 100,
  stockLevel: 'ok',
  status: 'active',
  version: 1,
  photoVersion: null,
  units: [
    {
      id: 'sack',
      label: 'Sac de 50 kg',
      factor: 50,
      salePrice: 30000,
      allowsDecimals: false,
      barcode: null,
      status: 'active',
      version: 1,
    },
  ],
  createdAt: '2026-10-28T08:00:00Z',
  updatedAt: '2026-10-28T08:00:00Z',
};
const products = new Map([[rice.id, rice]]);
const line = (overrides: Partial<CartLine>): CartLine => ({
  productId: 'rice',
  optionKey: 'stock',
  quantityText: '1',
  agreedText: '',
  ...overrides,
});
const seller = {
  manager: false,
  maxDiscountBasisPoints: null,
  sellerCanSellBelowCost: false,
};

describe('cart in several units (ADR-038)', () => {
  it('prices each unit and adds up the stock it takes', () => {
    const lines = priceCart(
      [
        line({ optionKey: 'unit:sack', quantityText: '2' }),
        line({ optionKey: 'conversion:g', quantityText: '250' }),
        line({ quantityText: '1,5' }),
      ],
      products,
    );
    const totals = totalsOf(lines, 0);
    expect(totals.lines.map((l) => l.lineTotal)).toEqual([60000, 163, 975]);
    expect(wantedStock(lines).get('rice')).toBe(101.75);
  });

  it('keeps sacks whole and grams whole', () => {
    const [sack, grams] = priceCart(
      [line({ optionKey: 'unit:sack' }), line({ optionKey: 'conversion:g' })],
      products,
    );
    expect(quantityError(sack!.option, 1.5)).toContain('entier');
    expect(quantityError(grams!.option, 2.5)).toContain('entier');
    expect(quantityError(grams!.option, 250)).toBeNull();
  });

  it('works out the quantity « for this amount »', () => {
    const [kilo, sack] = priceCart(
      [line({}), line({ optionKey: 'unit:sack' })],
      products,
    );
    expect(quantityForAmount(kilo!.option, 650, 500)).toBe(0.769);
    // Whole units round to the nearest one, at least one.
    expect(quantityForAmount(sack!.option, 650, 10000)).toBe(1);
    expect(quantityForAmount(kilo!.option, 650, 0)).toBeNull();
  });

  it('applies the seller limit and the purchase price before the sale', () => {
    const negotiated = priceCart(
      [line({ optionKey: 'unit:sack', agreedText: '27000' })],
      products,
    );
    const totals = totalsOf(negotiated, 0);
    expect(totals.listSubtotal - totals.total).toBe(3000); // 10 %
    expect(negotiationProblem(negotiated, totals, seller, 'XOF')).toBeNull();
    expect(
      negotiationProblem(
        negotiated,
        totals,
        { ...seller, maxDiscountBasisPoints: 500 },
        'XOF',
      ),
    ).toContain('5 %');

    const lossy = priceCart(
      [line({ optionKey: 'unit:sack', agreedText: '24000' })],
      products,
    );
    const lossyTotals = totalsOf(lossy, 0);
    expect(negotiationProblem(lossy, lossyTotals, seller, 'XOF')).toContain(
      'prix d’achat',
    );
    expect(
      negotiationProblem(
        lossy,
        lossyTotals,
        { ...seller, sellerCanSellBelowCost: true },
        'XOF',
      ),
    ).toBeNull();
    expect(
      negotiationProblem(
        lossy,
        lossyTotals,
        { ...seller, manager: true },
        'XOF',
      ),
    ).toBeNull();
  });
});
