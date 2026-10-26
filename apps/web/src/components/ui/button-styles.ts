/**
 * Shared button look (docs/DESIGN.md): at least 48 px high, 16 px bold
 * text, one strong color per intent. Used by links and buttons alike.
 */
const VARIANTS = {
  primary: 'bg-brand-strong text-white hover:bg-brand shadow-sm',
  secondary:
    'border-2 border-line-strong bg-surface text-ink hover:bg-surface-muted',
  danger: 'bg-danger-strong text-white hover:bg-danger shadow-sm',
  // Selling: green of the sales module. No lighter hover: white on the
  // vivid green would fall under 4.5:1 (DESIGN.md).
  sell: 'bg-sales-strong text-white shadow-sm hover:shadow-md',
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
  return `inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-2 text-base font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`.trim();
}
