import type { SaleDto } from '@nagaw/shared';
import { describe, expect, it } from 'vitest';
import { ticketLabel, ticketText, whatsappLink } from './ticket';

const sale: SaleDto = {
  id: 's1',
  saleNumber: 42,
  status: 'completed',
  customer: null,
  seller: { userId: 'u1', email: 'awa@acme.test' },
  lines: [
    {
      position: 1,
      productId: 'p1',
      label: 'Eau 1,5 L',
      unit: 'bouteille',
      productUnitId: null,
      unitLabel: null,
      unitFactor: 1,
      priceBasis: 'unit',
      unitPrice: 500,
      quantity: 3,
      baseQuantity: 3,
      listTotal: 1500,
      lineTotal: 1500,
      taxRateBasisPoints: 1800,
      taxAmount: 229,
    },
  ],
  payments: [{ method: 'cash', provider: null, reference: null, amount: 1500 }],
  subtotal: 1500,
  discount: 0,
  total: 1500,
  taxTotal: 229,
  cashReceived: 2000,
  changeGiven: 500,
  occurredAt: '2026-10-24T10:30:00.000Z',
  deviceTicket: null,
  priceReview: false,
  stockReview: false,
  cancellation: null,
};

const plain = (text: string) => text.replace(/[  ]/g, ' ');

describe('ticket label', () => {
  it('shows the device ticket of a sale made offline', () => {
    expect(ticketLabel({ saleNumber: 42, deviceTicket: null })).toBe(
      'n° 000042',
    );
    expect(ticketLabel({ saleNumber: 42, deviceTicket: 'B-000012' })).toBe(
      'n° 000042 (B-000012)',
    );
    expect(ticketLabel({ saleNumber: 0, deviceTicket: 'B-000012' })).toBe(
      'B-000012',
    );
  });
});

describe('ticket text', () => {
  it('lists lines, total, payments and change, in the shop time zone', () => {
    const text = plain(
      ticketText(sale, {
        name: 'Acme Dakar',
        currency: 'XOF',
        timeZone: 'Africa/Dakar',
      }),
    );
    expect(text).toContain('Ticket n° 000042 — 24/10/2026 10:30');
    expect(text).toContain(
      'Eau 1,5 L : 3 bouteilles × 500 F CFA = 1 500 F CFA',
    );
    expect(text).toContain('TOTAL : 1 500 F CFA');
    expect(text).toContain('Espèces : 1 500 F CFA');
    expect(text).toContain('Rendu : 500 F CFA');
    expect(text).not.toContain('ANNULÉE');
  });

  it('builds a WhatsApp link to the customer when the number is known', () => {
    expect(whatsappLink('Merci', '77 123 45 67')).toBe(
      'https://wa.me/771234567?text=Merci',
    );
    expect(whatsappLink('a b')).toBe('https://wa.me/?text=a%20b');
  });
});
