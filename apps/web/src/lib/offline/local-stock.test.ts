import type { ProductDto, SyncOperation } from '@nagaw/shared';
import { describe, expect, it } from 'vitest';
import { applyPendingStock, correctionProblem } from './local-stock';

const product = (overrides: Partial<ProductDto> = {}): ProductDto => ({
  kind: 'product',
  id: 'rice',
  name: 'Riz',
  category: null,
  unit: 'sac',
  salePrice: 1000,
  purchasePrice: null,
  taxRate: null,
  barcode: null,
  trackStock: true,
  lowStockThreshold: 2,
  stockQuantity: 5,
  stockLevel: 'ok',
  status: 'active',
  version: 1,
  photoVersion: null,
  units: [],
  createdAt: '2026-10-26T08:00:00Z',
  updatedAt: '2026-10-26T08:00:00Z',
  ...overrides,
});

const sale = (productId: string, quantity: number): SyncOperation => ({
  type: 'sale',
  clientOperationId: crypto.randomUUID(),
  data: {
    deviceTicket: 'A-000001',
    occurredAt: '2026-10-26T09:00:00Z',
    customerId: null,
    customerOperationId: null,
    lines: [
      {
        productId,
        productUnitId: null,
        conversion: null,
        quantity,
        unitPrice: 1000,
        agreedTotal: null,
      },
    ],
    discount: 0,
    payments: [
      { method: 'cash', amount: 1000, provider: null, reference: null },
    ],
    cashReceived: null,
  },
});

const correction = (productId: string, quantity: number): SyncOperation => ({
  type: 'stock_correction',
  clientOperationId: crypto.randomUUID(),
  data: {
    productId,
    quantity,
    countedQuantity: 10,
    reason: 'Recompté',
    occurredAt: '2026-10-26T09:00:00Z',
  },
});

describe('applyPendingStock', () => {
  it('takes out what this phone sold and adds its corrections', () => {
    const [rice] = applyPendingStock(
      [product()],
      [sale('rice', 2), correction('rice', 4), sale('rice', 1)],
    );
    expect(rice).toMatchObject({ stockQuantity: 6, stockLevel: 'ok' });
  });

  it('converts what was sold in another unit (ADR-038)', () => {
    const grams: SyncOperation = {
      ...sale('rice', 250),
    };
    if (grams.type === 'sale') grams.data.lines[0]!.conversion = 'g';
    const [rice] = applyPendingStock([product({ unit: 'kg' })], [grams]);
    expect(rice?.stockQuantity).toBe(4.75);
  });

  it('updates the level shown on the tile', () => {
    expect(applyPendingStock([product()], [sale('rice', 3)])[0]).toMatchObject({
      stockQuantity: 2,
      stockLevel: 'low',
    });
    expect(applyPendingStock([product()], [sale('rice', 6)])[0]).toMatchObject({
      stockQuantity: -1,
      stockLevel: 'out',
    });
  });

  it('leaves untracked and untouched products as they are', () => {
    const untracked = product({ id: 'service', trackStock: false });
    const other = product({ id: 'oil' });
    const result = applyPendingStock([untracked, other], [sale('service', 3)]);
    expect(result[0]).toBe(untracked);
    expect(result[1]).toBe(other);
  });
});

describe('correctionProblem', () => {
  it('limits sellers by the shop’s setting, never managers', () => {
    expect(correctionProblem(5, { manager: false, max: 20 })).toBeNull();
    expect(correctionProblem(-25, { manager: false, max: 20 })).toMatch(
      /plus de 20/,
    );
    expect(correctionProblem(5, { manager: false, max: 0 })).toMatch(
      /seuls le propriétaire/,
    );
    expect(correctionProblem(500, { manager: true, max: 0 })).toBeNull();
    expect(correctionProblem(0, { manager: true, max: 0 })).toMatch(
      /déjà juste/,
    );
  });
});
