import type { OrderStatus, OrderView } from '@nagaw/shared';

/** Words of an order (ADR-063), as the seller says them. */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'Nouvelle',
  confirmed: 'Confirmée',
  shipping: 'En livraison',
  delivered: 'Livrée',
  cancelled: 'Annulée',
};

export const ORDER_STATUS_TONES: Record<
  OrderStatus,
  'neutral' | 'brand' | 'success' | 'warning' | 'danger'
> = {
  new: 'warning',
  confirmed: 'brand',
  shipping: 'brand',
  delivered: 'success',
  cancelled: 'neutral',
};

export const ORDER_VIEW_LABELS: Record<OrderView, string> = {
  new: 'Nouvelles',
  open: 'En cours',
  remind: 'À relancer',
  all: 'Toutes',
};

/** `?vue=` of the list; unknown values fall back to the orders in progress. */
export const ORDER_VIEW_PARAMS: Record<string, OrderView> = {
  nouvelles: 'new',
  'en-cours': 'open',
  'a-relancer': 'remind',
  toutes: 'all',
};

export const orderViewParam = (view: OrderView) =>
  Object.entries(ORDER_VIEW_PARAMS).find(([, v]) => v === view)?.[0] ??
  'en-cours';
