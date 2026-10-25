import {
  formatAmount,
  formatRate,
  UNITS,
  type InvoiceDto,
  type QuoteDto,
  type ShopIdentityDto,
} from '@nagaw/shared';
import {
  PDFDocument,
  rgb,
  StandardFonts,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib';

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 40;
const INK = rgb(0.11, 0.11, 0.14);
const MUTED = rgb(0.38, 0.38, 0.44);
const LINE = rgb(0.85, 0.85, 0.88);
const BRAND = rgb(0.0, 0.42, 0.62);

/**
 * The standard fonts only know WinAnsi: Intl puts narrow no-break spaces in
 * amounts and a person may type any character, so anything else is replaced.
 */
const WIN_ANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');
export function pdfText(text: string): string {
  return [...text.replace(/[   ]/g, ' ').replace(/[\r\t]/g, ' ')]
    .map((ch) => {
      const code = ch.codePointAt(0)!;
      if (
        ch === '\n' ||
        (code >= 0x20 && code <= 0x7e) ||
        (code >= 0xa0 && code <= 0xff)
      )
        return ch;
      return WIN_ANSI_EXTRA.has(ch) ? ch : '?';
    })
    .join('');
}

function formatDay(day: string): string {
  const [y, m, d] = day.split('-');
  return `${d}/${m}/${y}`;
}

function quantity(value: number): string {
  return new Intl.NumberFormat('fr', { maximumFractionDigits: 3 }).format(
    value,
  );
}

/** Splits a text into lines no wider than `width`. */
function wrap(
  text: string,
  font: PDFFont,
  size: number,
  width: number,
): string[] {
  const lines: string[] = [];
  for (const paragraph of pdfText(text).split('\n')) {
    let current = '';
    for (const word of paragraph.split(' ')) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);
      // A single word wider than the column is cut.
      let rest = word;
      while (font.widthOfTextAtSize(rest, size) > width && rest.length > 1) {
        let cut = rest.length - 1;
        while (
          cut > 1 &&
          font.widthOfTextAtSize(rest.slice(0, cut), size) > width
        )
          cut -= 1;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      current = rest;
    }
    lines.push(current);
  }
  return lines;
}

type Document =
  { kind: 'quote'; quote: QuoteDto } | { kind: 'invoice'; invoice: InvoiceDto };

class Writer {
  page!: PDFPage;
  y = 0;

  constructor(
    readonly pdf: PDFDocument,
    readonly regular: PDFFont,
    readonly bold: PDFFont,
  ) {
    this.addPage();
  }

  addPage() {
    this.page = this.pdf.addPage([PAGE.width, PAGE.height]);
    this.y = PAGE.height - MARGIN;
  }

  text(
    value: string,
    x: number,
    options: {
      size?: number;
      bold?: boolean;
      color?: ReturnType<typeof rgb>;
      align?: 'left' | 'right';
    } = {},
  ) {
    const size = options.size ?? 10;
    const font = options.bold ? this.bold : this.regular;
    const clean = pdfText(value);
    const left =
      options.align === 'right' ? x - font.widthOfTextAtSize(clean, size) : x;
    this.page.drawText(clean, {
      x: left,
      y: this.y,
      size,
      font,
      color: options.color ?? INK,
    });
  }

  rule(y = this.y) {
    this.page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE.width - MARGIN, y },
      thickness: 0.7,
      color: LINE,
    });
  }

  /** Room for `height` points, or a new page. */
  ensure(height: number): boolean {
    if (this.y - height >= MARGIN + 30) return false;
    this.addPage();
    return true;
  }
}

const COLUMNS = {
  label: MARGIN,
  quantity: 330,
  unitPrice: 420,
  tax: 470,
  total: PAGE.width - MARGIN,
};

function tableHeader(w: Writer) {
  w.text('Désignation', COLUMNS.label, { bold: true, size: 9, color: MUTED });
  w.text('Qté', COLUMNS.quantity, {
    bold: true,
    size: 9,
    color: MUTED,
    align: 'right',
  });
  w.text('Prix unit. TTC', COLUMNS.unitPrice, {
    bold: true,
    size: 9,
    color: MUTED,
    align: 'right',
  });
  w.text('TVA', COLUMNS.tax, {
    bold: true,
    size: 9,
    color: MUTED,
    align: 'right',
  });
  w.text('Total TTC', COLUMNS.total, {
    bold: true,
    size: 9,
    color: MUTED,
    align: 'right',
  });
  w.y -= 6;
  w.rule();
  w.y -= 14;
}

/** A4 PDF of a quote, an invoice or a credit note (ADR-026). */
export async function renderDocumentPdf(
  shop: ShopIdentityDto,
  currency: string,
  doc: Document,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const w = new Writer(pdf, regular, bold);
  const money = (minor: number) => formatAmount(minor, currency);

  const base = doc.kind === 'quote' ? doc.quote : doc.invoice;
  const title =
    doc.kind === 'quote'
      ? 'DEVIS'
      : doc.invoice.kind === 'credit_note'
        ? 'AVOIR'
        : doc.invoice.status === 'draft'
          ? 'FACTURE (BROUILLON)'
          : 'FACTURE';
  pdf.setTitle(`${title} ${base.number ?? ''}`.trim());
  pdf.setCreator('Nagaw Business');

  // Shop, left; document, right.
  const top = w.y;
  w.text(shop.legalName || shop.name, MARGIN, {
    size: 16,
    bold: true,
    color: BRAND,
  });
  w.y -= 16;
  const shopLines = [
    shop.legalName && shop.legalName !== shop.name ? shop.name : '',
    ...shop.address.split('\n'),
    shop.phone ? `Tél. : ${shop.phone}` : '',
    shop.email,
    shop.taxId ? `NINEA : ${shop.taxId}` : '',
    shop.tradeRegister ? `RCCM : ${shop.tradeRegister}` : '',
  ].filter(Boolean);
  for (const line of shopLines) {
    w.text(line, MARGIN, { size: 9, color: MUTED });
    w.y -= 12;
  }
  const leftBottom = w.y;

  w.y = top;
  const right = PAGE.width - MARGIN;
  w.text(title, right, { size: 18, bold: true, align: 'right' });
  w.y -= 20;
  if (base.number) {
    w.text(`N° ${base.number}`, right, {
      size: 11,
      bold: true,
      align: 'right',
    });
    w.y -= 14;
  }
  const dates: string[] = [];
  if (doc.kind === 'quote') {
    dates.push(`Date : ${formatDay(doc.quote.issueDate)}`);
    dates.push(`Valable jusqu’au : ${formatDay(doc.quote.validUntil)}`);
  } else {
    const invoice = doc.invoice;
    if (invoice.issueDate) dates.push(`Date : ${formatDay(invoice.issueDate)}`);
    if (invoice.kind === 'invoice' && invoice.dueDate)
      dates.push(`À payer avant le : ${formatDay(invoice.dueDate)}`);
    if (invoice.creditFor?.number)
      dates.push(`Annule la facture ${invoice.creditFor.number}`);
    if (invoice.quote) dates.push(`Devis ${invoice.quote.number}`);
  }
  for (const line of dates) {
    w.text(line, right, { size: 9, color: MUTED, align: 'right' });
    w.y -= 12;
  }
  w.y = Math.min(w.y, leftBottom) - 16;

  // Customer.
  const customer = base.customer;
  const boxX = PAGE.width / 2;
  w.text('Client', boxX, { size: 9, bold: true, color: MUTED });
  w.y -= 14;
  w.text(customer.name, boxX, { size: 11, bold: true });
  w.y -= 13;
  for (const line of [
    ...customer.address.split('\n'),
    customer.phone ? `Tél. : ${customer.phone}` : '',
    customer.email,
    customer.taxId ? `NINEA : ${customer.taxId}` : '',
  ].filter(Boolean)) {
    w.text(line, boxX, { size: 9, color: MUTED });
    w.y -= 12;
  }
  w.y -= 18;

  // Lines.
  tableHeader(w);
  for (const line of base.lines) {
    const labelLines = wrap(
      line.label,
      regular,
      10,
      COLUMNS.quantity - COLUMNS.label - 50,
    );
    if (w.ensure(labelLines.length * 12 + 6)) tableHeader(w);
    const rowTop = w.y;
    w.text(
      `${quantity(line.quantity)} ${UNITS[line.unit].label}`,
      COLUMNS.quantity,
      { align: 'right' },
    );
    w.text(money(line.unitPrice), COLUMNS.unitPrice, { align: 'right' });
    w.text(
      line.taxRateBasisPoints ? formatRate(line.taxRateBasisPoints) : '—',
      COLUMNS.tax,
      {
        align: 'right',
      },
    );
    w.text(money(line.lineTotal), COLUMNS.total, { align: 'right' });
    for (const text of labelLines) {
      w.text(text, COLUMNS.label);
      w.y -= 12;
    }
    w.y = Math.min(w.y, rowTop - 12) - 4;
    w.rule(w.y + 8);
  }

  // Totals.
  const totals = base.totals;
  const rows: [string, string, boolean][] = [];
  if (totals.discount > 0) {
    rows.push(['Sous-total TTC', money(totals.subtotal), false]);
    rows.push(['Remise', `- ${money(totals.discount)}`, false]);
  }
  rows.push(['Total HT', money(totals.totalExcludingTax), false]);
  for (const tax of totals.taxByRate)
    rows.push([
      `TVA ${formatRate(tax.rateBasisPoints)}`,
      money(tax.amount),
      false,
    ]);
  rows.push(['Total TTC', money(totals.total), true]);
  if (
    doc.kind === 'invoice' &&
    doc.invoice.kind === 'invoice' &&
    doc.invoice.status === 'issued'
  ) {
    rows.push(['Déjà payé', money(doc.invoice.paid), false]);
    rows.push(['Reste à payer', money(doc.invoice.balance), true]);
  }
  w.ensure(rows.length * 16 + 20);
  w.y -= 8;
  for (const [label, value, strong] of rows) {
    w.text(label, 420, {
      size: strong ? 11 : 10,
      bold: strong,
      align: 'right',
    });
    w.text(value, COLUMNS.total, {
      size: strong ? 11 : 10,
      bold: strong,
      align: 'right',
    });
    w.y -= 16;
  }

  // Stamps.
  if (doc.kind === 'invoice') {
    const invoice = doc.invoice;
    const stamp =
      invoice.status === 'cancelled'
        ? `ANNULÉE${invoice.creditNote?.number ? ` par l’avoir ${invoice.creditNote.number}` : ''}`
        : invoice.kind === 'invoice' &&
            invoice.status === 'issued' &&
            invoice.balance === 0
          ? 'ACQUITTÉE'
          : invoice.status === 'draft'
            ? 'Brouillon : sans numéro, ce document n’a pas de valeur de facture.'
            : '';
    if (stamp) {
      w.y -= 6;
      w.text(stamp, MARGIN, { size: 12, bold: true, color: BRAND });
      w.y -= 18;
    }
    if (invoice.payments.length > 0 && invoice.kind === 'invoice') {
      w.ensure(invoice.payments.length * 12 + 20);
      w.text('Paiements reçus', MARGIN, { size: 9, bold: true, color: MUTED });
      w.y -= 12;
      for (const p of invoice.payments) {
        w.text(
          `${formatDay(p.paidOn)} — ${PAYMENT_LABELS[p.method]} — ${money(p.amount)}`,
          MARGIN,
          {
            size: 9,
            color: MUTED,
          },
        );
        w.y -= 12;
      }
    }
  }

  // Notes and footer.
  const tail = [base.notes, shop.invoiceFooter].filter(Boolean);
  for (const block of tail) {
    const lines = wrap(block, regular, 9, PAGE.width - 2 * MARGIN);
    w.y -= 8;
    w.ensure(lines.length * 11);
    for (const line of lines) {
      w.text(line, MARGIN, { size: 9, color: MUTED });
      w.y -= 11;
    }
  }

  const pages = pdf.getPages();
  pages.forEach((page, index) => {
    const label = pdfText(
      `${base.number ?? title} — page ${index + 1}/${pages.length}`,
    );
    page.drawText(label, {
      x: PAGE.width - MARGIN - regular.widthOfTextAtSize(label, 8),
      y: MARGIN - 10,
      size: 8,
      font: regular,
      color: MUTED,
    });
  });
  return pdf.save();
}

const PAYMENT_LABELS: Record<InvoiceDto['payments'][number]['method'], string> =
  {
    cash: 'Espèces',
    mobile_money: 'Mobile Money',
    card: 'Carte',
    bank_transfer: 'Virement',
    cheque: 'Chèque',
  };
