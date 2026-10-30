import {
  formatAmount,
  documentPalette,
  formatRate,
  UNITS,
  type InvoiceDto,
  type QuoteDto,
  type ShopIdentityDto,
  type ShopLogoType,
} from '@nagaw/shared';
import {
  PDFDocument,
  PDFImage,
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
// The shop's colour comes with each document; these never change.
const ROW = rgb(0.973, 0.969, 0.988);
const SUCCESS = rgb(0.082, 0.502, 0.239);
const DANGER = rgb(0.725, 0.11, 0.11);

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

export interface DocumentLogo {
  contentType: ShopLogoType;
  data: Uint8Array;
}

const LOGO_BOX = { width: 150, height: 60 };

/** Embeds a logo; throws when the image cannot be read. */
export async function embedLogo(
  pdf: PDFDocument,
  logo: DocumentLogo,
): Promise<PDFImage> {
  return logo.contentType === 'image/png'
    ? pdf.embedPng(logo.data)
    : pdf.embedJpg(logo.data);
}

function pdfColor(hex: string) {
  const [r, g, b] = [1, 3, 5].map(
    (at) => parseInt(hex.slice(at, at + 2), 16) / 255,
  ) as [number, number, number];
  return rgb(r, g, b);
}

/** The shop's palette, in PDF colours. */
export function pdfPalette(color: string) {
  const palette = documentPalette(color);
  return {
    accent: pdfColor(palette.accent),
    onAccent: pdfColor(palette.onAccent),
    text: pdfColor(palette.text),
    soft: pdfColor(palette.soft),
  };
}

class Writer {
  page!: PDFPage;
  y = 0;

  constructor(
    readonly pdf: PDFDocument,
    readonly regular: PDFFont,
    readonly bold: PDFFont,
    readonly colors: ReturnType<typeof pdfPalette>,
  ) {
    this.addPage();
  }

  addPage() {
    this.page = this.pdf.addPage([PAGE.width, PAGE.height]);
    this.box(0, PAGE.height, PAGE.width, 8, this.colors.accent);
    this.y = PAGE.height - MARGIN;
  }

  /** A filled rectangle, from its top left corner. */
  box(
    x: number,
    top: number,
    width: number,
    height: number,
    color: ReturnType<typeof rgb>,
  ) {
    this.page.drawRectangle({ x, y: top - height, width, height, color });
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

  /** Room for `height` points, or a new page. */
  ensure(height: number): boolean {
    if (this.y - height >= FOOTER_TOP + 12) return false;
    this.addPage();
    return true;
  }
}

const RIGHT = PAGE.width - MARGIN;
const CONTENT_WIDTH = RIGHT - MARGIN;
const COLUMNS = {
  label: MARGIN + 8,
  quantity: 315,
  unitPrice: 405,
  tax: 448,
  total: RIGHT - 8,
};

/** Bottom of the printed area: under it, the footer of the page. */
const FOOTER_TOP = MARGIN + 18;

function tableHeader(w: Writer) {
  w.box(MARGIN, w.y + 13, CONTENT_WIDTH, 22, w.colors.accent);
  const head = { bold: true, size: 9, color: w.colors.onAccent } as const;
  const right = { ...head, align: 'right' } as const;
  w.text('Désignation', COLUMNS.label, head);
  w.text('Qté', COLUMNS.quantity, right);
  w.text('Prix unit. TTC', COLUMNS.unitPrice, right);
  w.text('TVA', COLUMNS.tax, right);
  w.text('Total TTC', COLUMNS.total, right);
  w.y -= 24;
}

/** A4 PDF of a quote, an invoice or a credit note (ADR-026). */
export async function renderDocumentPdf(
  shop: ShopIdentityDto,
  currency: string,
  doc: Document,
  logo: DocumentLogo | null = null,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const colors = pdfPalette(shop.documentColor);
  const w = new Writer(pdf, regular, bold, colors);
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
  if (logo) {
    const image = await embedLogo(pdf, logo);
    const { width, height } = image.scaleToFit(LOGO_BOX.width, LOGO_BOX.height);
    w.y = top + 10 - height;
    w.page.drawImage(image, { x: MARGIN, y: w.y, width, height });
    w.y -= 20;
  }
  const shopWidth = CONTENT_WIDTH * 0.58;
  for (const line of wrap(shop.legalName || shop.name, bold, 15, shopWidth)) {
    w.text(line, MARGIN, { size: 15, bold: true, color: colors.text });
    w.y -= 17;
  }
  w.y += 2;
  const shopLines = [
    shop.legalName && shop.legalName !== shop.name ? shop.name : '',
    ...shop.address.split('\n'),
    shop.phone ? `Tél. : ${shop.phone}` : '',
    shop.email,
    shop.taxId ? `NINEA : ${shop.taxId}` : '',
    shop.tradeRegister ? `RCCM : ${shop.tradeRegister}` : '',
  ]
    .filter(Boolean)
    .flatMap((line) => wrap(line, regular, 9, shopWidth));
  for (const line of shopLines) {
    w.text(line, MARGIN, { size: 9, color: MUTED });
    w.y -= 12;
  }
  const leftBottom = w.y;

  w.y = top;
  w.text(title, RIGHT, { size: 20, bold: true, align: 'right' });
  w.y -= 20;
  if (base.number) {
    w.text(`N° ${base.number}`, RIGHT, {
      size: 11,
      bold: true,
      color: colors.text,
      align: 'right',
    });
    w.y -= 15;
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
    w.text(line, RIGHT, { size: 9, color: MUTED, align: 'right' });
    w.y -= 12;
  }
  w.y = Math.min(w.y, leftBottom) - 12;

  // Customer, in a tinted panel.
  const customer = base.customer;
  const panelWidth = CONTENT_WIDTH - 24;
  const nameLines = wrap(customer.name, bold, 11, panelWidth);
  const customerLines = [
    ...customer.address.split('\n'),
    customer.phone ? `Tél. : ${customer.phone}` : '',
    customer.email,
    customer.taxId ? `NINEA : ${customer.taxId}` : '',
  ]
    .filter(Boolean)
    .flatMap((line) => wrap(line, regular, 9, panelWidth));
  const panelHeight = 30 + nameLines.length * 14 + customerLines.length * 12;
  w.box(MARGIN, w.y, CONTENT_WIDTH, panelHeight, colors.soft);
  w.box(MARGIN, w.y, 3, panelHeight, colors.accent);
  const panelBottom = w.y - panelHeight;
  w.y -= 17;
  w.text(doc.kind === 'quote' ? 'Devis pour' : 'Facturé à', MARGIN + 12, {
    size: 9,
    bold: true,
    color: colors.text,
  });
  w.y -= 15;
  for (const line of nameLines) {
    w.text(line, MARGIN + 12, { size: 11, bold: true });
    w.y -= 14;
  }
  for (const line of customerLines) {
    w.text(line, MARGIN + 12, { size: 9, color: MUTED });
    w.y -= 12;
  }
  w.y = panelBottom - 28;

  // Lines, one row in two tinted.
  tableHeader(w);
  base.lines.forEach((line, index) => {
    const labelLines = wrap(
      line.label,
      regular,
      10,
      COLUMNS.quantity - COLUMNS.label - 55,
    );
    const rowHeight = labelLines.length * 12 + 10;
    if (w.ensure(rowHeight)) tableHeader(w);
    const rowTop = w.y + 13;
    if (index % 2 === 1) w.box(MARGIN, rowTop, CONTENT_WIDTH, rowHeight, ROW);
    w.y -= 1;
    w.text(
      `${quantity(line.quantity)} ${UNITS[line.unit].label}`,
      COLUMNS.quantity,
      { align: 'right' },
    );
    w.text(money(line.unitPrice), COLUMNS.unitPrice, { align: 'right' });
    w.text(
      line.taxRateBasisPoints ? formatRate(line.taxRateBasisPoints) : '—',
      COLUMNS.tax,
      { align: 'right' },
    );
    w.text(money(line.lineTotal), COLUMNS.total, {
      bold: true,
      align: 'right',
    });
    for (const text of labelLines) {
      w.text(text, COLUMNS.label);
      w.y -= 12;
    }
    w.y = rowTop - rowHeight - 12;
  });

  // Totals, on the right; what the customer pays stands out.
  const totals = base.totals;
  const rows: { label: string; value: string; strong?: boolean }[] = [];
  if (totals.discount > 0) {
    rows.push({ label: 'Sous-total TTC', value: money(totals.subtotal) });
    rows.push({ label: 'Remise', value: `- ${money(totals.discount)}` });
  }
  rows.push({ label: 'Total HT', value: money(totals.totalExcludingTax) });
  for (const tax of totals.taxByRate)
    rows.push({
      label: `TVA ${formatRate(tax.rateBasisPoints)}`,
      value: money(tax.amount),
    });
  rows.push({ label: 'Total TTC', value: money(totals.total), strong: true });
  if (
    doc.kind === 'invoice' &&
    doc.invoice.kind === 'invoice' &&
    doc.invoice.status === 'issued'
  ) {
    rows.push({ label: 'Déjà payé', value: money(doc.invoice.paid) });
    rows.push({
      label: 'Reste à payer',
      value: money(doc.invoice.balance),
      strong: true,
    });
  }
  w.ensure(rows.length * 24 + 20);
  w.y -= 6;
  const totalsLeft = 325;
  for (const { label, value, strong } of rows) {
    if (strong) {
      w.box(totalsLeft, w.y + 14, RIGHT - totalsLeft, 24, colors.accent);
      w.y -= 1;
    }
    const style = strong
      ? ({ size: 12, bold: true, color: colors.onAccent } as const)
      : ({ size: 10 } as const);
    w.text(label, totalsLeft + 10, style);
    w.text(value, COLUMNS.total, { ...style, align: 'right' });
    w.y -= strong ? 25 : 18;
  }

  // Stamp: what became of the document.
  if (doc.kind === 'invoice') {
    const invoice = doc.invoice;
    const cancelled = invoice.status === 'cancelled';
    const paidInFull =
      invoice.kind === 'invoice' &&
      invoice.status === 'issued' &&
      invoice.balance === 0;
    const stamp = cancelled
      ? `ANNULÉE${invoice.creditNote?.number ? ` par l’avoir ${invoice.creditNote.number}` : ''}`
      : paidInFull
        ? 'ACQUITTÉE'
        : invoice.status === 'draft'
          ? 'Brouillon : sans numéro, ce document n’a pas de valeur de facture.'
          : '';
    if (stamp) {
      const color = cancelled ? DANGER : paidInFull ? SUCCESS : MUTED;
      const clean = pdfText(stamp);
      w.y -= 6;
      w.ensure(40);
      w.page.drawRectangle({
        x: MARGIN,
        y: w.y - 8,
        width: bold.widthOfTextAtSize(clean, 11) + 20,
        height: 24,
        borderColor: color,
        borderWidth: 1.5,
      });
      w.text(clean, MARGIN + 10, { size: 11, bold: true, color });
      w.y -= 30;
    }
    if (invoice.payments.length > 0 && invoice.kind === 'invoice') {
      w.ensure(invoice.payments.length * 12 + 20);
      w.text('Paiements reçus', MARGIN, {
        size: 9,
        bold: true,
        color: colors.text,
      });
      w.y -= 13;
      for (const p of invoice.payments) {
        w.text(
          `${formatDay(p.paidOn)} — ${PAYMENT_LABELS[p.method]} — ${money(p.amount)}`,
          MARGIN,
          { size: 9, color: MUTED },
        );
        w.y -= 12;
      }
    }
  }

  // Notes and footer of the shop.
  const tail = [base.notes, shop.invoiceFooter].filter(Boolean);
  for (const block of tail) {
    const lines = wrap(block, regular, 9, CONTENT_WIDTH);
    w.y -= 8;
    w.ensure(lines.length * 11);
    for (const line of lines) {
      w.text(line, MARGIN, { size: 9, color: MUTED });
      w.y -= 11;
    }
  }

  const pages = pdf.getPages();
  const legal = [
    shop.legalName || shop.name,
    shop.taxId ? `NINEA ${shop.taxId}` : '',
    shop.tradeRegister ? `RCCM ${shop.tradeRegister}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const footer = wrap(legal, regular, 8, CONTENT_WIDTH * 0.7)[0] ?? '';
  pages.forEach((page, index) => {
    page.drawLine({
      start: { x: MARGIN, y: FOOTER_TOP - 4 },
      end: { x: RIGHT, y: FOOTER_TOP - 4 },
      thickness: 0.7,
      color: LINE,
    });
    page.drawText(footer, {
      x: MARGIN,
      y: MARGIN - 10,
      size: 8,
      font: regular,
      color: MUTED,
    });
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
