import { describe, expect, it } from 'vitest';
import {
  availabilityOf,
  declineReasonText,
  firstNameOf,
  isStorefrontSlug,
  publicOrderSchema,
  slugify,
  storefrontDueOnAllowed,
} from './storefront.js';

describe('storefront addresses (ADR-075)', () => {
  it('makes an address from a shop name, without accents', () => {
    expect(slugify('Chez Aïssatou & fils')).toBe('chez-aissatou-fils');
    expect(slugify('  Boutique   Ndèye  ')).toBe('boutique-ndeye');
    expect(slugify('A'.repeat(60))).toHaveLength(40);
  });

  it('refuses reserved, too short or badly formed addresses', () => {
    expect(isStorefrontSlug('chez-awa')).toBe(true);
    for (const bad of ['admin', 'api', 'ab', '-awa', 'awa-', 'a--b', 'Awa'])
      expect(isStorefrontSlug(bad)).toBe(false);
  });
});

describe('availability in words', () => {
  const product = {
    kind: 'product' as const,
    trackStock: true,
    stockQuantity: 10,
    lowStockThreshold: 3,
  };
  it('never shows a number: available, few, sold out', () => {
    expect(availabilityOf(product)).toBe('available');
    expect(availabilityOf({ ...product, stockQuantity: 3 })).toBe('few');
    expect(availabilityOf({ ...product, stockQuantity: 0 })).toBe('sold_out');
    expect(availabilityOf({ ...product, stockQuantity: -2 })).toBe('sold_out');
  });
  it('treats services and uncounted stock as available', () => {
    expect(
      availabilityOf({ ...product, kind: 'service', stockQuantity: 0 }),
    ).toBe('available');
    expect(
      availabilityOf({ ...product, trackStock: false, stockQuantity: 0 }),
    ).toBe('available');
  });
});

describe('a storefront order', () => {
  const valid = {
    clientOperationId: '7d2c4b9e-3c1a-4f5e-9b8a-1a2b3c4d5e6f',
    lines: [{ article: 'bazin-riche', quantity: 2 }],
    dueOn: '2026-11-30',
    name: 'Mariama Diop',
    phone: '77 123 45 67',
  };
  it('accepts what a customer sends, and nothing else', () => {
    expect(publicOrderSchema.safeParse(valid).success).toBe(true);
    for (const extra of [
      { fulfilment: 'delivery' },
      { customerId: valid.clientOperationId },
      { deposit: { method: 'cash', amount: 100 } },
    ])
      expect(publicOrderSchema.safeParse({ ...valid, ...extra }).success).toBe(
        false,
      );
    expect(
      publicOrderSchema.safeParse({ ...valid, phone: '77 12' }).success,
    ).toBe(false);
    expect(publicOrderSchema.safeParse({ ...valid, lines: [] }).success).toBe(
      false,
    );
  });

  it('allows today to thirty days ahead', () => {
    expect(storefrontDueOnAllowed('2026-11-28', '2026-11-28')).toBe(true);
    expect(storefrontDueOnAllowed('2026-12-28', '2026-11-28')).toBe(true);
    expect(storefrontDueOnAllowed('2026-12-29', '2026-11-28')).toBe(false);
    expect(storefrontDueOnAllowed('2026-11-27', '2026-11-28')).toBe(false);
  });

  it('writes the reason of a refusal and keeps the first name only', () => {
    expect(declineReasonText({ reason: 'sold_out', detail: '' })).toBe(
      'Épuisé',
    );
    expect(declineReasonText({ reason: 'other', detail: 'En voyage' })).toBe(
      'En voyage',
    );
    expect(firstNameOf('  Mariama Diop ')).toBe('Mariama');
  });
});
