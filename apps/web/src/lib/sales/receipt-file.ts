/**
 * The ticket as a file to send: a picture (PNG) or a PDF, made on the
 * phone itself so that it works offline and for a sale not yet sent. No
 * library: the ticket is drawn on a canvas, and the PDF is one page that
 * holds that picture as a JPEG.
 */

const WIDTH = 576; // px, about the width of an 80 mm till roll at 2 px/pt
const PADDING = 32;
const FONT = 'ui-monospace, "Cascadia Mono", Menlo, Consolas, monospace';

/** Lines cut to the width of the ticket, words kept whole when possible. */
function wrap(
  context: CanvasRenderingContext2D,
  text: string,
  width: number,
): string[] {
  if (text === '' || context.measureText(text).width <= width) return [text];
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(' ')) {
    const next = current ? `${current} ${word}` : word;
    if (context.measureText(next).width <= width) current = next;
    else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Drawn twice as fine as its layout, so that the photo stays sharp when
 * WhatsApp shows it on a phone screen.
 */
const SCALE = 2;

/** The ticket text (`ticketText`) drawn as a till receipt. */
export function drawReceipt(text: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D indisponible');
  const inner = WIDTH - PADDING * 2;
  const rows: { text: string; size: number; bold: boolean; center: boolean }[] =
    [];
  text.split('\n').forEach((line, index) => {
    const title = index === 0;
    const strong = /^(TOTAL|VENTE ANNULÉE)/.test(line);
    const size = title ? 30 : strong ? 26 : 22;
    context.font = `${strong || title ? 'bold ' : ''}${size}px ${FONT}`;
    for (const part of wrap(context, line, inner))
      rows.push({
        text: part,
        size,
        bold: title || strong,
        center: title || line === 'Merci de votre visite !',
      });
  });
  const lineHeight = (size: number) => Math.round(size * 1.45);
  const height =
    PADDING * 2 + rows.reduce((sum, row) => sum + lineHeight(row.size), 0);
  // Resizing the canvas resets its context: the scale comes after.
  canvas.width = WIDTH * SCALE;
  canvas.height = height * SCALE;
  context.scale(SCALE, SCALE);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, WIDTH, height);
  context.fillStyle = '#111827';
  context.textBaseline = 'top';
  let y = PADDING;
  for (const row of rows) {
    context.font = `${row.bold ? 'bold ' : ''}${row.size}px ${FONT}`;
    context.textAlign = row.center ? 'center' : 'left';
    context.fillText(row.text, row.center ? WIDTH / 2 : PADDING, y);
    y += lineHeight(row.size);
  }
  return canvas;
}

function toBlob(
  canvas: HTMLCanvasElement,
  type: 'image/png' | 'image/jpeg',
): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error('Image non produite')),
      type,
      0.92,
    ),
  );
}

export async function receiptPng(text: string): Promise<Blob> {
  return toBlob(drawReceipt(text), 'image/png');
}

export async function receiptPdf(text: string): Promise<Blob> {
  const canvas = drawReceipt(text);
  const jpeg = new Uint8Array(
    await (await toBlob(canvas, 'image/jpeg')).arrayBuffer(),
  );
  // The page keeps the size of the layout; the picture is finer.
  return new Blob([jpegToPdf(jpeg, canvas.width, canvas.height, 2 * SCALE)], {
    type: 'application/pdf',
  });
}

/**
 * A one-page PDF showing a JPEG at 2 px per point by default (PDF 1.4: the JPEG goes
 * in as is, with the DCTDecode filter). Offsets of the cross-reference
 * table are counted in bytes.
 */
export function jpegToPdf(
  jpeg: Uint8Array,
  widthPx: number,
  heightPx: number,
  /** Pixels per point: 2 for the layout, more for a finer picture. */
  pxPerPoint = 2,
): Uint8Array<ArrayBuffer> {
  const w = (widthPx / pxPerPoint).toFixed(2);
  const h = (heightPx / pxPerPoint).toFixed(2);
  const ascii = (text: string) => new TextEncoder().encode(text);
  const content = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (part: Uint8Array) => {
    parts.push(part);
    length += part.length;
  };
  const object = (id: number, body: Uint8Array[]) => {
    offsets[id] = length;
    push(ascii(`${id} 0 obj\n`));
    for (const piece of body) push(piece);
    push(ascii('\nendobj\n'));
  };
  push(ascii('%PDF-1.4\n'));
  object(1, [ascii('<< /Type /Catalog /Pages 2 0 R >>')]);
  object(2, [ascii('<< /Type /Pages /Kids [3 0 R] /Count 1 >>')]);
  object(3, [
    ascii(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
    ),
  ]);
  object(4, [
    ascii(
      `<< /Type /XObject /Subtype /Image /Width ${widthPx} /Height ${heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
    ),
    jpeg,
    ascii('\nendstream'),
  ]);
  object(5, [
    ascii(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`),
  ]);
  const xref = length;
  push(
    ascii(
      `xref\n0 6\n0000000000 65535 f \n${[1, 2, 3, 4, 5]
        .map((id) => `${String(offsets[id]).padStart(10, '0')} 00000 n \n`)
        .join(
          '',
        )}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`,
    ),
  );
  const out = new Uint8Array(new ArrayBuffer(length));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/**
 * « Ticket 000001 A-000001 » from « n° 000001 (A-000001) »: a name that
 * reads well in WhatsApp, without signs some phones refuse in file names.
 */
export function receiptFileName(label: string): string {
  const clean = label
    .replace(/^n°\s*/, '')
    .replace(/[()]/g, '')
    .replace(/[^\p{L}\p{N} -]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  return `Ticket ${clean}`;
}
