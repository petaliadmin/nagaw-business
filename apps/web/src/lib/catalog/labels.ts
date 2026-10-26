import {
  formatQuantity,
  UNITS,
  type CategoryColor,
  type StockLevel,
  type StockMovementKind,
  type Unit,
} from '@nagaw/shared';

// Shared with the API, which writes quantities in notifications (ADR-036).
export { formatQuantity };

/** Signed change: `+6 pièces`, `−3 pièces`. */
export function formatQuantityChange(quantity: number, unit: Unit): string {
  const sign = quantity > 0 ? '+' : quantity < 0 ? '−' : '';
  return `${sign}${formatQuantity(Math.abs(quantity), unit)}`;
}

export const STOCK_LEVEL_LABELS: Record<StockLevel, string> = {
  ok: 'En stock',
  low: 'Bientôt épuisé',
  out: 'Épuisé',
  untracked: 'Stock non suivi',
};

export const STOCK_LEVEL_TONES = {
  ok: 'success',
  low: 'warning',
  out: 'danger',
  untracked: 'neutral',
} as const satisfies Record<StockLevel, string>;

export const MOVEMENT_LABELS: Record<StockMovementKind, string> = {
  initial: 'Stock de départ',
  purchase: 'Entrée de marchandises',
  sale: 'Vente',
  return: 'Retour d’un client',
  loss: 'Perte ou casse',
  inventory: 'Inventaire',
  adjustment: 'Correction',
};

export const CATEGORY_COLOR_LABELS: Record<CategoryColor, string> = {
  brand: 'Violet',
  stock: 'Bleu',
  sales: 'Vert',
  accounting: 'Turquoise',
  warning: 'Jaune',
  stats: 'Orange',
  invoices: 'Rose',
  danger: 'Rouge',
};

/** Full class names, so that Tailwind generates them (no string building). */
export const CATEGORY_TONES: Record<CategoryColor, string> = {
  brand: 'bg-brand-soft text-brand-ink',
  stock: 'bg-stock-soft text-stock-ink',
  sales: 'bg-sales-soft text-sales-ink',
  accounting: 'bg-accounting-soft text-accounting-ink',
  warning: 'bg-warning-soft text-warning-ink',
  stats: 'bg-stats-soft text-stats-ink',
  invoices: 'bg-invoices-soft text-invoices-ink',
  danger: 'bg-danger-soft text-danger-ink',
};

export const UNIT_OPTIONS = (Object.keys(UNITS) as Unit[]).map((unit) => ({
  value: unit,
  label: UNITS[unit].label,
}));
