import { describe, expect, it } from 'vitest';
import { jpegToPdf } from './receipt-file';

const text = (bytes: Uint8Array) => new TextDecoder('latin1').decode(bytes);

describe('jpegToPdf', () => {
  // Not a real JPEG: the PDF holds its bytes as they are.
  const jpeg = new Uint8Array([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9]);
  const pdf = jpegToPdf(jpeg, 576, 900);
  const body = text(pdf);

  it('is a one-page PDF at 2 px per point', () => {
    expect(body.startsWith('%PDF-1.4\n')).toBe(true);
    expect(body.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(body).toContain('/MediaBox [0 0 288.00 450.00]');
    expect(body).toContain('/Count 1');
    expect(body).toContain('/Filter /DCTDecode /Length 7');
  });

  it('keeps the JPEG bytes untouched', () => {
    const start = body.indexOf('stream\n', body.indexOf('/DCTDecode')) + 7;
    expect([...pdf.slice(start, start + jpeg.length)]).toEqual([...jpeg]);
  });

  it('points its cross-reference table at each object', () => {
    const xref = Number(/startxref\n(\d+)/.exec(body)?.[1]);
    expect(body.slice(xref, xref + 4)).toBe('xref');
    const offsets = [...body.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) =>
      Number(m[1]),
    );
    expect(offsets).toHaveLength(5);
    offsets.forEach((offset, index) =>
      expect(body.slice(offset, offset + 8)).toBe(`${index + 1} 0 obj\n`),
    );
  });
});
