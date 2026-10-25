import type { InvoiceDto, ShopIdentityDto } from '@nagaw/shared';
import { computeDocumentTotals } from '@nagaw/shared';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { pdfText, renderDocumentPdf } from './pdf.js';

const shop: ShopIdentityDto = {
  name: 'Boutique Awa',
  legalName: 'Awa Commerce SARL',
  address: 'Rue 10, Médina\nDakar',
  phone: '77 000 00 00',
  email: 'awa@example.com',
  taxId: '0012345 2G3',
  tradeRegister: 'SN-DKR-2026-B-1',
  invoiceFooter: 'Merci pour votre confiance.',
  invoiceDueDays: 30,
  quoteValidityDays: 30,
};

function invoice(lineCount: number): InvoiceDto {
  const lines = Array.from({ length: lineCount }, (_, i) => ({
    productId: null,
    label: `Article n° ${i + 1} — désignation assez longue pour passer sur deux lignes du tableau`,
    unit: 'piece' as const,
    quantity: 2,
    unitPrice: 1180,
    taxRateBasisPoints: 1800,
  }));
  const totals = computeDocumentTotals(lines, 0);
  return {
    id: 'i',
    kind: 'invoice',
    number: 'F-2026-0001',
    status: 'issued',
    paymentState: 'partially_paid',
    issueDate: '2026-10-24',
    dueDate: '2026-11-23',
    overdue: false,
    customer: {
      id: 'c',
      name: 'Moussa Ndiaye',
      phone: '',
      email: '',
      address: '',
      taxId: '',
    },
    lines: lines.map((l, i) => ({ ...l, lineTotal: totals.lineTotals[i]! })),
    notes: 'Livraison comprise',
    totals,
    paid: 1000,
    balance: totals.total - 1000,
    payments: [
      {
        id: 'p',
        method: 'cash',
        provider: null,
        reference: null,
        amount: 1000,
        paidOn: '2026-10-24',
        fromSale: false,
      },
    ],
    quote: null,
    sale: null,
    creditFor: null,
    creditNote: null,
    cancellation: null,
    createdAt: '2026-10-24T10:00:00.000Z',
    updatedAt: '2026-10-24T10:00:00.000Z',
  };
}

describe('document PDF', () => {
  it('keeps French text and replaces what the standard font cannot draw', () => {
    expect(pdfText('12 500 F CFA')).toBe('12 500 F CFA');
    expect(pdfText('Désignation « été » — 5 €')).toBe(
      'Désignation « été » — 5 €',
    );
    expect(pdfText('Riz 🍚')).toBe('Riz ?');
  });

  it('renders an invoice, on several pages when it is long', async () => {
    const short = await PDFDocument.load(
      await renderDocumentPdf(shop, 'XOF', {
        kind: 'invoice',
        invoice: invoice(2),
      }),
    );
    expect(short.getPageCount()).toBe(1);
    expect(short.getTitle()).toBe('FACTURE F-2026-0001');
    const long = await PDFDocument.load(
      await renderDocumentPdf(shop, 'XOF', {
        kind: 'invoice',
        invoice: invoice(60),
      }),
    );
    expect(long.getPageCount()).toBeGreaterThan(1);
  });
});
