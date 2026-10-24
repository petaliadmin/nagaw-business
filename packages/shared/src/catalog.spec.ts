import { describe, expect, it } from 'vitest';
import {
  createProductSchema,
  createStockMovementSchema,
  formatRate,
  quantityFitsUnit,
  quantitySchema,
  stockLevel,
  updateProductSchema,
} from './catalog.js';
import { roleHasPermission } from './permissions.js';

const OP = '6f1c1b2e-5d7a-4c3e-9f10-2b3c4d5e6f70';
const product = {
  name: 'Riz parfumé 5 kg',
  categoryId: null,
  unit: 'sac',
  salePrice: 6500,
  purchasePrice: 5200,
  taxRateId: null,
  barcode: '',
  trackStock: true,
  lowStockThreshold: 5,
  clientOperationId: OP,
};

describe('quantities', () => {
  it('accepts up to three decimals', () => {
    expect(quantitySchema.safeParse(1.255).success).toBe(true);
    expect(quantitySchema.safeParse(1.2555).success).toBe(false);
    expect(quantitySchema.safeParse(Number.NaN).success).toBe(false);
  });

  it('keeps whole units whole, weights and volumes may have decimals', () => {
    expect(quantityFitsUnit(2, 'piece')).toBe(true);
    expect(quantityFitsUnit(2.5, 'piece')).toBe(false);
    expect(quantityFitsUnit(2.5, 'kg')).toBe(true);
    expect(quantityFitsUnit(0.75, 'litre')).toBe(true);
  });
});

describe('stock level', () => {
  const at = (stockQuantity: number, lowStockThreshold: number | null) =>
    stockLevel({ trackStock: true, stockQuantity, lowStockThreshold });

  it('says out of stock at zero or below, low at the threshold', () => {
    expect(at(0, 5)).toBe('out');
    expect(at(-2, null)).toBe('out');
    expect(at(5, 5)).toBe('low');
    expect(at(6, 5)).toBe('ok');
    expect(at(1, null)).toBe('ok');
    expect(
      stockLevel({ trackStock: false, stockQuantity: 0, lowStockThreshold: 5 }),
    ).toBe('untracked');
  });
});

describe('product schemas', () => {
  it('turns an empty barcode into « no barcode » and defaults the initial stock', () => {
    const parsed = createProductSchema.parse(product);
    expect(parsed.barcode).toBeNull();
    expect(parsed.initialStock).toBeNull();
  });

  it('refuses an initial stock when stock is not tracked', () => {
    const result = createProductSchema.safeParse({
      ...product,
      trackStock: false,
      initialStock: 3,
    });
    expect(result.success).toBe(false);
  });

  it('refuses server-owned fields and negative prices', () => {
    expect(
      createProductSchema.safeParse({ ...product, organizationId: OP }).success,
    ).toBe(false);
    expect(
      createProductSchema.safeParse({ ...product, salePrice: -1 }).success,
    ).toBe(false);
    expect(
      createProductSchema.safeParse({ ...product, salePrice: 10.5 }).success,
    ).toBe(false);
  });

  it('needs the version read before an update, and something to change', () => {
    expect(updateProductSchema.safeParse({ name: 'Riz' }).success).toBe(false);
    expect(updateProductSchema.safeParse({ version: 3 }).success).toBe(false);
    expect(
      updateProductSchema.safeParse({ name: 'Riz', version: 3 }).success,
    ).toBe(true);
  });
});

describe('stock movement schema', () => {
  it('only accepts the movements a person records by hand', () => {
    for (const kind of ['sale', 'return', 'initial', 'adjustment']) {
      expect(
        createStockMovementSchema.safeParse({
          kind,
          quantity: 1,
          clientOperationId: OP,
        }).success,
      ).toBe(false);
    }
  });

  it('asks why for a loss, and a count for an inventory', () => {
    expect(
      createStockMovementSchema.safeParse({
        kind: 'loss',
        quantity: 2,
        clientOperationId: OP,
      }).success,
    ).toBe(false);
    expect(
      createStockMovementSchema.safeParse({
        kind: 'inventory',
        countedQuantity: 0,
        clientOperationId: OP,
      }).success,
    ).toBe(true);
    expect(
      createStockMovementSchema.safeParse({
        kind: 'purchase',
        quantity: 0,
        clientOperationId: OP,
      }).success,
    ).toBe(false);
  });
});

describe('formatting and permissions', () => {
  it('formats tax rates in French', () => {
    expect(formatRate(1800)).toBe('18 %');
    expect(formatRate(550)).toBe('5,5 %');
  });

  it('lets everyone read the catalogue, only managers change it or move stock', () => {
    for (const role of ['owner', 'admin', 'member', 'viewer'] as const)
      expect(roleHasPermission(role, 'catalog.read')).toBe(true);
    for (const role of ['owner', 'admin'] as const) {
      expect(roleHasPermission(role, 'catalog.manage')).toBe(true);
      expect(roleHasPermission(role, 'stock.move')).toBe(true);
    }
    for (const role of ['member', 'viewer'] as const) {
      expect(roleHasPermission(role, 'catalog.manage')).toBe(false);
      expect(roleHasPermission(role, 'stock.move')).toBe(false);
    }
  });
});
