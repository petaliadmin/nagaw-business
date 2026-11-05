import { describe, expect, it } from 'vitest';
import {
  canMove,
  courierText,
  deliverOrderSchema,
  isToRemind,
  ORDER_REFERENCE_RE,
  orderReference,
  orderReminderText,
  publicOrderSchema,
} from './orders.js';

const order = {
  reference: 'CMD-7K2Q9X',
  customerName: 'Awa Diop',
  customerPhone: '221771234567',
  customerArea: 'Médina, rue 11',
  customerNote: '',
  total: 12500,
  currency: 'XOF',
  paidAt: null,
  deliveryFee: 1000,
};

describe('orders', () => {
  it('moves forward only, and never out of a closed order', () => {
    expect(canMove('new', 'confirmed')).toBe(true);
    expect(canMove('confirmed', 'delivered')).toBe(true);
    expect(canMove('new', 'delivered')).toBe(false);
    expect(canMove('shipping', 'confirmed')).toBe(false);
    expect(canMove('delivered', 'cancelled')).toBe(false);
    expect(canMove('cancelled', 'confirmed')).toBe(false);
  });

  it('reminds the orders on their way that are not paid', () => {
    expect(isToRemind({ status: 'confirmed', paidAt: null })).toBe(true);
    expect(isToRemind({ status: 'shipping', paidAt: null })).toBe(true);
    expect(isToRemind({ status: 'confirmed', paidAt: '2026-11-05' })).toBe(
      false,
    );
    expect(isToRemind({ status: 'new', paidAt: null })).toBe(false);
  });

  it('draws a short reference', () => {
    const reference = orderReference(new Uint8Array([0, 1, 35, 36, 200, 255]));
    expect(reference).toMatch(ORDER_REFERENCE_RE);
    expect(reference).toBe('CMD-01Z0K3');
  });

  it('reads the order of a customer', () => {
    const lines = [
      { productId: '11111111-1111-4111-8111-111111111111', quantity: 2 },
    ];
    const valid = {
      name: 'Awa Diop',
      phone: '77 123 45 67',
      area: 'Médina',
      lines,
      expectedTotal: 1000,
    };
    expect(publicOrderSchema.parse(valid).note).toBe('');
    for (const wrong of [
      { lines: [] },
      { lines: [...lines, ...lines] },
      { lines: [{ ...lines[0], quantity: 0 }] },
      { lines: [{ ...lines[0], quantity: 1.5 }] },
      { phone: '12' },
      { name: '' },
      { area: ' ' },
      { extra: true },
    ])
      expect(publicOrderSchema.safeParse({ ...valid, ...wrong }).success).toBe(
        false,
      );
  });

  it('asks the operator of a Mobile Money payment', () => {
    expect(
      deliverOrderSchema.safeParse({
        payment: { method: 'mobile_money', provider: null },
      }).success,
    ).toBe(false);
    expect(
      deliverOrderSchema.parse({ payment: { method: 'cash' } }).payment,
    ).toEqual({ method: 'cash', provider: null, reference: '' });
    expect(deliverOrderSchema.parse({}).payment).toBeNull();
  });

  it('prepares the messages the seller sends', () => {
    expect(orderReminderText(order, 'Boutique Awa')).toContain('CMD-7K2Q9X');
    const courier = courierText(order);
    expect(courier).toContain('+221771234567');
    expect(courier).toContain('À encaisser');
    expect(courierText({ ...order, paidAt: '2026-11-05' })).toContain(
      'Déjà payée',
    );
  });
});
