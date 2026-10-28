import { describeSaleLine, formatAmount, type SaleDto } from '@nagaw/shared';
import { PAYMENT_LABELS, PROVIDER_LABELS, ticketNumber } from './labels';

/**
 * `n° 000042`, `n° 000042 (B-000012)` for a sale made on a device, or
 * `B-000012` while it waits to be sent and has no server number yet.
 */
export function ticketLabel(
  sale: Pick<SaleDto, 'saleNumber' | 'deviceTicket'>,
): string {
  if (sale.saleNumber <= 0 && sale.deviceTicket) return sale.deviceTicket;
  const number = ticketNumber(sale.saleNumber);
  return sale.deviceTicket ? `${number} (${sale.deviceTicket})` : number;
}

/**
 * The ticket as plain text, to share on WhatsApp or by SMS. Same content as
 * the printed ticket; amounts in the shop's currency.
 */
export function ticketText(
  sale: SaleDto,
  shop: { name: string; currency: string; timeZone: string },
): string {
  const money = (value: number) => formatAmount(value, shop.currency);
  const when = new Intl.DateTimeFormat('fr', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: shop.timeZone,
  }).format(new Date(sale.occurredAt));
  const lines = [
    shop.name,
    `Ticket ${ticketLabel(sale)} — ${when}`,
    '',
    ...sale.lines.map(
      (line) =>
        `${line.label} : ${describeSaleLine(line, money)} = ${money(line.lineTotal)}${line.lineTotal !== line.listTotal ? ' (prix convenu)' : ''}`,
    ),
    '',
  ];
  if (sale.discount > 0) lines.push(`Remise : −${money(sale.discount)}`);
  lines.push(`TOTAL : ${money(sale.total)}`);
  for (const payment of sale.payments) {
    const provider = payment.provider
      ? ` (${PROVIDER_LABELS[payment.provider]})`
      : '';
    lines.push(
      `${PAYMENT_LABELS[payment.method]}${provider} : ${money(payment.amount)}`,
    );
  }
  if (sale.changeGiven !== null && sale.changeGiven > 0)
    lines.push(`Rendu : ${money(sale.changeGiven)}`);
  if (sale.status === 'cancelled') lines.push('', 'VENTE ANNULÉE');
  lines.push('', 'Merci de votre visite !');
  return lines.join('\n');
}

/** WhatsApp link with the ticket (to the customer's number when known). */
export function whatsappLink(text: string, phone?: string | null): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
