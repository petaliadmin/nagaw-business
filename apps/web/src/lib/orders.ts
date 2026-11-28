import {
  ORDER_STATUS_LABELS,
  type OrderDto,
  type OrderStatus,
} from '@nagaw/shared';
import { formatCalendarDate } from '@/lib/format';

/** Tone of the badge of each step (ADR-072). */
export const ORDER_STATUS_TONES: Record<
  OrderStatus,
  'neutral' | 'brand' | 'success' | 'warning' | 'danger'
> = {
  to_confirm: 'warning',
  received: 'neutral',
  in_preparation: 'brand',
  ready: 'success',
  out_for_delivery: 'warning',
  delivered: 'success',
  cancelled: 'danger',
};

/** « 30 nov. 2026 à 16:00 ». */
export function dueLabel(order: Pick<OrderDto, 'dueOn' | 'dueTime'>): string {
  const day = formatCalendarDate(order.dueOn);
  return order.dueTime ? `${day} à ${order.dueTime}` : day;
}

/** Who the order is for: the customer, or the person who sent it. */
export function orderPerson(order: Pick<OrderDto, 'customer' | 'requester'>): {
  name: string;
  phone: string;
} {
  return order.customer ?? order.requester ?? { name: '', phone: '' };
}

/** The order as text, to send on WhatsApp: the « bon de commande ». */
export function orderText(
  order: OrderDto,
  shopName: string,
  money: (value: number) => string,
): string {
  const lines = [
    shopName,
    `Commande ${order.number} — ${ORDER_STATUS_LABELS[order.status]}`,
    `Pour le ${dueLabel(order)}${order.fulfilment === 'delivery' ? ', livrée' : ''}`,
    '',
    ...order.lines.map(
      (l) =>
        `${l.label} × ${String(l.quantity).replace('.', ',')} = ${money(l.lineTotal)}${l.note ? ` (${l.note})` : ''}`,
    ),
  ];
  if (order.deliveryFee > 0)
    lines.push(`Livraison : ${money(order.deliveryFee)}`);
  lines.push('', `TOTAL : ${money(order.total)}`);
  if (order.paid > 0) lines.push(`Avance reçue : ${money(order.paid)}`);
  lines.push(`Reste à payer : ${money(order.remaining)}`, '', 'Merci !');
  return lines.join('\n');
}
