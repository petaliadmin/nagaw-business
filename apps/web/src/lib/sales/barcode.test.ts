import type { ProductDto } from '@nagaw/shared';
import { describe, expect, it } from 'vitest';
import { findByCode, isNewRead, SAME_CODE_PAUSE_MS } from './barcode';

const rice: ProductDto = {
  id: 'rice',
  kind: 'product',
  name: 'Riz',
  category: null,
  unit: 'kg',
  salePrice: 650,
  purchasePrice: 500,
  taxRate: null,
  barcode: '6111000000017',
  trackStock: true,
  lowStockThreshold: null,
  stockQuantity: 100,
  stockLevel: 'ok',
  status: 'active',
  version: 1,
  openPrice: false,
  systemRole: null,
  photoVersion: null,
  units: [
    {
      id: 'sack',
      label: 'Sac de 50 kg',
      factor: 50,
      salePrice: 30000,
      allowsDecimals: false,
      barcode: '6111000000024',
      status: 'active',
      version: 1,
    },
  ],
  createdAt: '2026-10-28T08:00:00Z',
  updatedAt: '2026-10-28T08:00:00Z',
};
const soap: ProductDto = {
  ...rice,
  id: 'soap',
  name: 'Savon',
  unit: 'piece',
  barcode: 'SAVON-01',
  units: [],
};

describe('findByCode (ADR-068)', () => {
  it('sells the stock unit for the product’s own code', () => {
    const match = findByCode([soap, rice], '6111000000017');
    expect(match?.product.id).toBe('rice');
    expect(match?.option.key).toBe('stock');
  });

  it('sells the unit whose code was read', () => {
    const match = findByCode([rice], '6111000000024');
    expect(match?.option.key).toBe('unit:sack');
    expect(match?.option.factor).toBe(50);
  });

  it('reads a QR code holding the same text, spaces around ignored', () => {
    expect(findByCode([rice, soap], ' SAVON-01\n')?.product.id).toBe('soap');
  });

  it('finds nothing for an unknown or empty code', () => {
    expect(findByCode([rice], '0000')).toBeNull();
    expect(findByCode([rice], '   ')).toBeNull();
  });
});

describe('isNewRead', () => {
  it('counts a box once while it stays in view', () => {
    const last = { code: 'A', seenAt: 1000 };
    expect(isNewRead('A', last, 1000 + SAME_CODE_PAUSE_MS - 1)).toBe(false);
  });

  it('counts the next box of the same product once the first left the view', () => {
    expect(
      isNewRead('A', { code: 'A', seenAt: 1000 }, 1000 + SAME_CODE_PAUSE_MS),
    ).toBe(true);
  });

  it('counts another code at once', () => {
    expect(isNewRead('B', { code: 'A', seenAt: 1000 }, 1001)).toBe(true);
    expect(isNewRead('A', null, 0)).toBe(true);
  });
});
