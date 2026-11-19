/**
 * Shared button look (docs/DESIGN.md, ADR-063): pills at least 48 px high,
 * 16 px bold text. The main action is ink (white text, 18.8:1); the others
 * are grey. Used by links and buttons alike.
 */
const VARIANTS = {
  primary: 'bg-ink text-canvas hover:opacity-90',
  secondary: 'bg-surface text-ink hover:bg-line',
  danger: 'bg-danger-strong text-white hover:bg-danger',
  // Selling and paying: the main action of the checkout, in ink too. Green
  // stays for the money itself (amounts, « Vente enregistrée »).
  sell: 'bg-ink text-canvas hover:opacity-90',
  // On a dark module colour (dashboard): outlined in white.
  // The violet focus ring would vanish on the module colour: white instead.
  outlineOnDark:
    'border-2 border-white text-white hover:bg-white/15 focus-visible:outline-white',
} as const;

export type ButtonVariant = keyof typeof VARIANTS;

export function buttonClasses(
  variant: ButtonVariant = 'primary',
  className = '',
): string {
  return `inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 py-2 text-base font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`.trim();
}
