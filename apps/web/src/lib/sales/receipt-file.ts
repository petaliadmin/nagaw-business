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
  canvas.width = WIDTH;
  canvas.height =
    PADDING * 2 + rows.reduce((sum, row) => sum + lineHeight(row.size), 0);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
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
  return new Blob([jpegToPdf(jpeg, canvas.width, canvas.height)], {
    type: 'application/pdf',
  });
}

/**
 * A one-page PDF showing a JPEG at 2 px per point (PDF 1.4: the JPEG goes
 * in as is, with the DCTDecode filter). Offsets of the cross-reference
 * table are counted in bytes.
 */
export function jpegToPdf(
  jpeg: Uint8Array,
  widthPx: number,
  heightPx: number,
): Uint8Array<ArrayBuffer> {
  const w = (widthPx / 2).toFixed(2);
  const h = (heightPx / 2).toFixed(2);
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
