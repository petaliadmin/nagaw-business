import { describe, expect, it } from 'vitest';
import {
  createOrderSchema,
  orderLineTotal,
  orderTotals,
  statusesFor,
} from './orders.js';

const OP = '6f1c1b2e-5d7a-4c3e-9f10-2b3c4d5e6f70';
const CUSTOMER = '7f1c1b2e-5d7a-4c3e-9f10-2b3c4d5e6f70';

describe('customer orders (ADR-072)', () => {
  it('adds the delivery fee to the articles and takes refunds off', () => {
    expect(
      orderTotals({
        itemsTotal: 10000,
        deliveryFee: 1000,
        payments: [
          { kind: 'deposit', amount: 5000 },
          { kind: 'deposit', amount: 2000 },
        ],
      }),
    ).toEqual({ total: 11000, paid: 7000, remaining: 4000 });
    expect(
      orderTotals({
        itemsTotal: 3000,
        deliveryFee: 0,
        payments: [
          { kind: 'deposit', amount: 3000 },
          { kind: 'refund', amount: 3000 },
        ],
      }),
    ).toEqual({ total: 3000, paid: 0, remaining: 3000 });
  });

  it('prices a line at its agreed amount, else the catalogue', () => {
    expect(orderLineTotal(5000, 2, null)).toBe(10000);
    expect(orderLineTotal(5000, 2, 9000)).toBe(9000);
  });

  it('offers « En livraison » only to an order that is delivered', () => {
    expect(statusesFor('pickup')).not.toContain('out_for_delivery');
    expect(statusesFor('delivery')).toContain('out_for_delivery');
  });

  it('asks a free line for its name and price, a delivery for its place', () => {
    const base = {
      clientOperationId: OP,
      customerId: CUSTOMER,
      dueOn: '2026-11-30',
      fulfilment: 'pickup',
    };
    const issues = (value: object) =>
      createOrderSchema
        .safeParse({ ...base, ...value })
        .error?.issues.map((i) => i.message) ?? [];
    expect(issues({ lines: [{ quantity: 1 }] })).toEqual(
      expect.arrayContaining([
        'Nommez l’article',
        'Tapez le prix de l’article',
      ]),
    );
    expect(
      issues({
        lines: [{ label: 'Robe', quantity: 1, agreedTotal: 15000 }],
        fulfilment: 'delivery',
      }),
    ).toEqual(['Où faut-il livrer ?']);
    expect(
      issues({
        lines: [{ label: 'Robe', quantity: 1, agreedTotal: 15000 }],
        dueTime: '25:00',
      }),
    ).toEqual(['Heure invalide (HH:MM)']);
  });
});
