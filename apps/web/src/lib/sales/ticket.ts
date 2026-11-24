import {
  describeSaleLine,
  formatAmount,
  internationalPhone,
  type SaleDto,
} from '@nagaw/shared';
import { paymentLabel, ticketNumber } from './labels';

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
    ...(sale.orderNumber ? [`Commande ${sale.orderNumber}`] : []),
    '',
    ...sale.lines.map(
      (line) =>
        `${line.label} : ${describeSaleLine(line, money)} = ${money(line.lineTotal)}${line.lineTotal !== line.listTotal ? ' (prix convenu)' : ''}`,
    ),
    '',
  ];
  if (sale.discount > 0) lines.push(`Remise : −${money(sale.discount)}`);
  lines.push(`TOTAL : ${money(sale.total)}`);
  for (const payment of sale.payments)
    lines.push(`${paymentLabel(payment)} : ${money(payment.amount)}`);
  if (sale.changeGiven !== null && sale.changeGiven > 0)
    lines.push(`Rendu : ${money(sale.changeGiven)}`);
  if (sale.status === 'cancelled') lines.push('', 'VENTE ANNULÉE');
  lines.push('', 'Merci de votre visite !');
  return lines.join('\n');
}

/** A courteous reminder, sent by the shop itself from its own WhatsApp. */
export function creditReminderText(
  customerName: string,
  shopName: string,
  amount: string,
): string {
  return `Bonjour ${customerName}, ici ${shopName}. Il reste ${amount} à régler sur vos achats. Merci de passer quand vous pouvez. Bonne journée !`;
}

/**
 * WhatsApp link with the ticket, to the customer's number when known. A
 * local number goes out with the country code of the shop: without it,
 * WhatsApp finds nobody.
 */
export function whatsappLink(
  text: string,
  phone?: string | null,
  countryCode?: string,
): string {
  const number = internationalPhone(phone, countryCode) ?? '';
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
