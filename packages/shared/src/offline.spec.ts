import { describe, expect, it } from 'vitest';
import {
  deviceTicketPrefix,
  formatDeviceTicket,
  syncRequestSchema,
} from './offline.js';

const UUID = (n: number) =>
  `6f1c1b2e-5d7a-4c3e-9f10-${String(n).padStart(12, '0')}`;

describe('device tickets', () => {
  it('names devices A to Z, then AA, AB…', () => {
    expect([1, 2, 26, 27, 28, 52, 53, 702].map(deviceTicketPrefix)).toEqual([
      'A',
      'B',
      'Z',
      'AA',
      'AB',
      'AZ',
      'BA',
      'ZZ',
    ]);
  });

  it('pads offline ticket numbers', () => {
    expect(formatDeviceTicket('B', 12)).toBe('B-000012');
  });
});

describe('sync request', () => {
  const sale = {
    type: 'sale',
    clientOperationId: UUID(2),
    data: {
      deviceTicket: 'B-000012',
      occurredAt: '2026-10-24T10:30:00.000+00:00',
      lines: [{ productId: UUID(3), quantity: 2, unitPrice: 500 }],
      payments: [{ method: 'cash', amount: 1000 }],
    },
  };

  it('accepts a new customer followed by a sale to that customer', () => {
    const parsed = syncRequestSchema.safeParse({
      deviceId: UUID(1),
      operations: [
        { type: 'customer', clientOperationId: UUID(4), data: { name: 'Awa' } },
        { ...sale, data: { ...sale.data, customerOperationId: UUID(4) } },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it('refuses unknown operations, bad tickets and empty or oversized batches', () => {
    const request = (operations: unknown[]) =>
      syncRequestSchema.safeParse({ deviceId: UUID(1), operations }).success;
    expect(request([])).toBe(false);
    expect(request([{ ...sale, type: 'refund' }])).toBe(false);
    expect(
      request([{ ...sale, data: { ...sale.data, deviceTicket: '12' } }]),
    ).toBe(false);
    expect(request(Array.from({ length: 51 }, () => sale))).toBe(false);
    expect(
      request([
        {
          ...sale,
          data: {
            ...sale.data,
            customerId: UUID(5),
            customerOperationId: UUID(6),
          },
        },
      ]),
    ).toBe(false);
  });
});
