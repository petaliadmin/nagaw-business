import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  DOCUMENT_COLORS,
  documentColorSchema,
  documentPalette,
} from './document-colors.js';

describe('documentPalette', () => {
  const colors = [
    ...DOCUMENT_COLORS.map((c) => c.value),
    '#ffff00',
    '#ffffff',
    '#00ff00',
    '#000000',
  ];

  it('keeps text readable, whatever the colour chosen', () => {
    for (const color of colors) {
      const palette = documentPalette(color);
      expect(contrastRatio(palette.onAccent, palette.accent)).toBeGreaterThan(
        4.4,
      );
      expect(contrastRatio(palette.text, '#ffffff')).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });

  it('keeps the colour as chosen for the bands', () => {
    expect(documentPalette('#ffff00').accent).toBe('#ffff00');
    expect(documentPalette('#1d4ed8').text).toBe('#1d4ed8');
  });

  it('accepts only a full hexadecimal colour', () => {
    expect(documentColorSchema.parse(' #AABBCC ')).toBe('#aabbcc');
    for (const value of ['red', '#abc', '#12345g', ''])
      expect(documentColorSchema.safeParse(value).success).toBe(false);
  });
});
