/**
 * One colour per module (DESIGN.md), as on the home page: a soft
 * background, its ink for titles, a vivid badge for icons, a strong fill
 * for bars (3:1 against the surface) and a dark panel for key figures
 * (white text at 5:1 or more, the strong colours staying the same in dark
 * mode). Literal classes, for Tailwind.
 */
export const MODULE_TONES = {
  brand: {
    soft: 'bg-brand-soft',
    ink: 'text-brand-ink',
    badge: 'bg-brand-strong text-white',
    dark: 'bg-brand-strong text-white',
    bar: 'bg-brand-strong',
  },
  sales: {
    soft: 'bg-sales-soft',
    ink: 'text-sales-ink',
    badge: 'bg-sales-strong text-white',
    dark: 'bg-sales-strong text-white',
    bar: 'bg-sales-strong',
  },
  stock: {
    soft: 'bg-stock-soft',
    ink: 'text-stock-ink',
    badge: 'bg-stock-strong text-white',
    dark: 'bg-stock-strong text-white',
    bar: 'bg-stock-strong',
  },
  invoices: {
    soft: 'bg-invoices-soft',
    ink: 'text-invoices-ink',
    badge: 'bg-invoices-strong text-white',
    dark: 'bg-invoices-strong text-white',
    bar: 'bg-invoices-strong',
  },
  stats: {
    soft: 'bg-stats-soft',
    ink: 'text-stats-ink',
    badge: 'bg-stats-strong text-white',
    dark: 'bg-stats-strong text-white',
    bar: 'bg-stats-chart',
  },
  accounting: {
    soft: 'bg-accounting-soft',
    ink: 'text-accounting-ink',
    badge: 'bg-accounting-strong text-white',
    dark: 'bg-accounting-strong text-white',
    bar: 'bg-accounting-strong',
  },
  // Status colours (DESIGN.md): out of stock, running low.
  danger: {
    soft: 'bg-danger-soft',
    ink: 'text-danger-ink',
    badge: 'bg-danger-strong text-white',
    dark: 'bg-danger-strong text-white',
    bar: 'bg-danger-strong',
  },
  warning: {
    soft: 'bg-warning-soft',
    ink: 'text-warning-ink',
    badge: 'bg-warning-strong text-white',
    dark: 'bg-warning-strong text-white',
    bar: 'bg-warning-strong',
  },
} as const;

export type ModuleTone = keyof typeof MODULE_TONES;
