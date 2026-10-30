import { z } from 'zod';

/** The violet of the application, until a shop chooses its colour (ADR-044). */
export const DEFAULT_DOCUMENT_COLOR = '#6d28d9';

/** Colours offered first; any other can be picked. */
export const DOCUMENT_COLORS = [
  { value: DEFAULT_DOCUMENT_COLOR, label: 'Violet' },
  { value: '#1d4ed8', label: 'Bleu' },
  { value: '#0f766e', label: 'Turquoise' },
  { value: '#15803d', label: 'Vert' },
  { value: '#c2410c', label: 'Orange' },
  { value: '#b91c1c', label: 'Rouge' },
  { value: '#be185d', label: 'Rose' },
  { value: '#111827', label: 'Noir' },
] as const;

export const documentColorSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^#[0-9a-f]{6}$/, 'Couleur invalide');

const INK = '#111827';
const WHITE = '#ffffff';

type Rgb = [number, number, number];

function toRgb(hex: string): Rgb {
  return [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)) as Rgb;
}

function toHex(color: Rgb): string {
  return `#${color
    .map((c) => Math.round(c).toString(16).padStart(2, '0'))
    .join('')}`;
}

function mix(from: Rgb, to: Rgb, share: number): Rgb {
  return from.map((c, i) => c + (to[i]! - c) * share) as Rgb;
}

function luminance(color: Rgb): number {
  const [r, g, b] = color.map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio of two `#rrggbb` colours. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(toRgb(a)), luminance(toRgb(b))].sort(
    (x, y) => y - x,
  ) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

export interface DocumentPalette {
  /** Bands and table headers: the shop's colour as chosen. */
  accent: string;
  /** Text on `accent`. */
  onAccent: string;
  /** Text on white: darkened if needed, so that a yellow stays readable. */
  text: string;
  /** Pale background of a panel. */
  soft: string;
}

/**
 * The shades of a document from one colour: whatever the shop picks, text
 * on it and in it keeps a contrast of 4.5:1 (DESIGN.md).
 */
export function documentPalette(color: string): DocumentPalette {
  const accent = toRgb(color);
  let text = accent;
  for (let share = 0.1; contrastRatio(toHex(text), WHITE) < 4.5; share += 0.1)
    text = mix(accent, [0, 0, 0], Math.min(share, 1));
  return {
    accent: color,
    onAccent: contrastRatio(color, WHITE) >= 4.5 ? WHITE : INK,
    text: toHex(text),
    soft: toHex(mix(accent, [255, 255, 255], 0.92)),
  };
}
