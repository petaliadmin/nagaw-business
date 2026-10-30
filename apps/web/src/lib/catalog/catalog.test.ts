import { createProductSchema } from '@nagaw/shared';
import { describe, expect, it } from 'vitest';
import { optionalQuantityField, productValues } from './form';
import { formatQuantity, formatQuantityChange } from './labels';

const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};

describe('catalogue forms', () => {
  it('reads amounts in the shop currency and empty fields as null', () => {
    const values = productValues(
      form({
        name: ' Riz parfumé ',
        categoryId: '',
        unit: 'sac',
        salePrice: '12 500',
        purchasePrice: '',
        taxRateId: '',
        barcode: '',
        trackStock: 'on',
        lowStockThreshold: '5',
      }),
      'XOF',
    );
    expect(values).toEqual({
      kind: 'product',
      name: 'Riz parfumé',
      categoryId: null,
      unit: 'sac',
      salePrice: 12500,
      purchasePrice: null,
      taxRateId: null,
      barcode: '',
      trackStock: true,
      lowStockThreshold: 5,
    });
    const parsed = createProductSchema.safeParse({
      ...values,
      clientOperationId: '6f1c1b2e-5d7a-4c3e-9f10-2b3c4d5e6f70',
    });
    expect(parsed.success).toBe(true);
  });

  it('turns unreadable numbers into errors on the right field', () => {
    const values = productValues(
      form({
        name: 'Riz',
        unit: 'sac',
        salePrice: '12,5',
        lowStockThreshold: 'beaucoup',
      }),
      'XOF',
    );
    const result = createProductSchema.safeParse({
      ...values,
      clientOperationId: '6f1c1b2e-5d7a-4c3e-9f10-2b3c4d5e6f70',
    });
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((issue) => issue.path[0]);
    expect(paths).toEqual(
      expect.arrayContaining(['salePrice', 'lowStockThreshold']),
    );
  });

  it('accepts a decimal comma for quantities', () => {
    expect(optionalQuantityField(form({ q: '2,5' }), 'q')).toBe(2.5);
    expect(optionalQuantityField(form({ q: '' }), 'q')).toBeNull();
  });
});

describe('quantities in words', () => {
  it('uses the plural of the unit when needed', () => {
    expect(formatQuantity(1, 'piece')).toBe('1 pièce');
    expect(formatQuantity(12, 'piece')).toBe('12 pièces');
    expect(formatQuantity(1.5, 'kg')).toBe('1,5 kg');
    expect(formatQuantity(3, 'metre')).toBe('3 mètres');
    expect(formatQuantityChange(-3, 'sac')).toBe('−3 sacs');
    expect(formatQuantityChange(6, 'sac')).toBe('+6 sacs');
  });
});
