import { describe, expect, it } from 'vitest';
import {
  baseQuantityOf,
  conversionOf,
  displayPriceOf,
  pricingOf,
  sellingOptionsOf,
  createProductSchema,
  perUnit,
  createProductUnitSchema,
  createStockMovementSchema,
  formatRate,
  quantityFitsUnit,
  quantitySchema,
  stockLevel,
  updateProductSchema,
  updateProductUnitSchema,
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

describe('perUnit', () => {
  it('says the unit after a price', () => {
    expect(perUnit('piece')).toBe('la pièce');
    expect(perUnit('kg')).toBe('le kg');
    expect(perUnit('heure')).toBe('l’heure');
    expect(perUnit('forfait')).toBe('le forfait');
  });
});

describe('a service', () => {
  const base = {
    name: 'Coupe',
    categoryId: null,
    unit: 'prestation',
    salePrice: 2000,
    purchasePrice: null,
    taxRateId: null,
    barcode: null,
    lowStockThreshold: null,
    clientOperationId: '6f1e5a52-1a33-4d6b-9f6a-0f5f2a1c7a10',
  };

  it('has no stock', () => {
    expect(
      createProductSchema.safeParse({
        ...base,
        kind: 'service',
        trackStock: false,
      }).success,
    ).toBe(true);
    expect(
      createProductSchema.safeParse({
        ...base,
        kind: 'service',
        trackStock: true,
      }).success,
    ).toBe(false);
  });

  it('leaves older clients with products', () => {
    expect(
      createProductSchema.parse({ ...base, unit: 'piece', trackStock: true })
        .kind,
    ).toBe('product');
  });
});

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

describe('selling units (ADR-038)', () => {
  it('converts a quantity to the stock unit, within 3 decimals', () => {
    expect(baseQuantityOf(2, 50)).toBe(100);
    expect(baseQuantityOf(1.5, 0.25)).toBe(0.375);
    expect(baseQuantityOf(0.1, 0.2)).toBe(0.02);
    expect(baseQuantityOf(0.5, 0.001)).toBeNull();
  });

  it('never lets the factor of a unit change', () => {
    const OP = '6f1c1b2e-5d7a-4c3e-9f10-2b3c4d5e6f70';
    expect(
      createProductUnitSchema.parse({
        label: ' Sac de 50 kg ',
        factor: 50,
        salePrice: 30000,
        clientOperationId: OP,
      }),
    ).toMatchObject({
      label: 'Sac de 50 kg',
      allowsDecimals: false,
      barcode: null,
    });
    expect(
      createProductUnitSchema.safeParse({
        label: 'Sac',
        factor: 0,
        salePrice: 1,
        clientOperationId: OP,
      }).success,
    ).toBe(false);
    expect(
      updateProductUnitSchema.safeParse({ factor: 25, version: 1 }).success,
    ).toBe(false);
  });
});

describe('what a product is sold in (ADR-038)', () => {
  const rice = {
    unit: 'kg' as const,
    salePrice: 650,
    units: [
      {
        id: 'sack',
        label: 'Sac de 50 kg',
        factor: 50,
        salePrice: 30000,
        allowsDecimals: false,
        barcode: null,
        status: 'active' as const,
        version: 1,
      },
      {
        id: 'half',
        label: 'Demi-sac',
        factor: 25,
        salePrice: null,
        allowsDecimals: false,
        barcode: null,
        status: 'active' as const,
        version: 1,
      },
    ],
  };

  it('offers the stock unit, its conversions, then its units', () => {
    expect(sellingOptionsOf(rice).map((o) => o.key)).toEqual([
      'stock',
      'conversion:g',
      'unit:sack',
      'unit:half',
    ]);
    expect(conversionOf('kg', 'g')?.factor).toBe(0.001);
    expect(conversionOf('piece', 'g')).toBeNull();
    expect(
      sellingOptionsOf({ unit: 'piece', salePrice: 100, units: [] }),
    ).toHaveLength(1);
  });

  it('prices a unit with its own price, anything else from the stock unit', () => {
    const [stock, grams, sack, half] = sellingOptionsOf(rice);
    expect(pricingOf(stock!, 650, 2)).toEqual({
      basis: 'unit',
      unitPrice: 650,
      pricedQuantity: 2,
    });
    expect(pricingOf(grams!, 650, 250)).toEqual({
      basis: 'stock',
      unitPrice: 650,
      pricedQuantity: 0.25,
    });
    expect(pricingOf(sack!, 650, 2).unitPrice).toBe(30000);
    expect(pricingOf(half!, 650, 1)).toEqual({
      basis: 'stock',
      unitPrice: 650,
      pricedQuantity: 25,
    });
    expect(displayPriceOf(half!, 650)).toBe(16250);
  });
});
