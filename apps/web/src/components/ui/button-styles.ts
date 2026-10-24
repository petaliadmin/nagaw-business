/**
 * Shared button look (docs/DESIGN.md): at least 48 px high, 16 px bold
 * text, one strong color per intent. Used by links and buttons alike.
 */
const VARIANTS = {
  primary: 'bg-brand-strong text-white hover:bg-brand shadow-sm',
  secondary:
    'border-2 border-line-strong bg-surface text-ink hover:bg-surface-muted',
  danger: 'bg-danger-strong text-white hover:bg-danger shadow-sm',
} as const;

export type ButtonVariant = keyof typeof VARIANTS;

export function buttonClasses(
  variant: ButtonVariant = 'primary',
  className = '',
): string {
  return `inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-2 text-base font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`.trim();
}
