'use client';

import type { SaleDto } from '@nagaw/shared';
import { CloudOff, MessageCircle, Printer, ShoppingCart } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button-styles';
import { formatQuantity } from '@/lib/catalog/labels';
import { PAYMENT_LABELS, PROVIDER_LABELS } from '@/lib/sales/labels';
import { ticketLabel, ticketText, whatsappLink } from '@/lib/sales/ticket';
import type { LocalTicket, ShopSnapshot } from '@/lib/offline/store';

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-3 ${strong ? 'text-xl font-extrabold' : ''}`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/**
 * Ticket of a sale recorded on this device: printable and shareable even
 * without network, with its offline number until the server gives its own.
 */
export function LocalTicketView({
  ticket,
  sale,
  shop,
  money,
  onNext,
}: {
  ticket: LocalTicket;
  sale: SaleDto;
  shop: ShopSnapshot['shop'];
  money: (value: number) => string;
  onNext: () => void;
}) {
  const label = ticketLabel(sale);
  const share = ticketText(sale, {
    name: shop.name,
    currency: shop.currency,
    timeZone: shop.timeZone,
  });
  return (
    <>
      <style>
        {'@media print { @page { size: 58mm auto; margin: 2mm; } }'}
      </style>
      <div className="flex flex-col gap-3 print:hidden">
        <Alert tone="success">
          Vente enregistrée.
          {sale.changeGiven !== null && sale.changeGiven > 0 && (
            <strong className="block text-2xl">
              À rendre : {money(sale.changeGiven)}
            </strong>
          )}
        </Alert>
        {ticket.status === 'pending' && (
          <p
            role="status"
            className="flex items-center gap-2 rounded-xl bg-warning-soft p-3 font-semibold text-warning-ink"
          >
            <CloudOff aria-hidden className="size-5 shrink-0" />
            Gardée sur ce téléphone : elle sera envoyée dès le retour du réseau.
          </p>
        )}
        {ticket.status === 'rejected' && (
          <Alert tone="error">
            Vente refusée par le serveur : {ticket.reason}
          </Alert>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold md:text-3xl">
            Ticket {label}
          </h1>
          <button
            type="button"
            onClick={onNext}
            className={buttonClasses('sell')}
          >
            <ShoppingCart aria-hidden className="size-5" />
            Nouvelle vente
          </button>
        </div>
      </div>

      <article
        aria-label={`Ticket ${label}`}
        className="mx-auto flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-line bg-surface p-5 font-mono text-base shadow-sm print:max-w-none print:border-0 print:p-0 print:text-sm print:shadow-none"
      >
        <header className="text-center">
          <p className="text-lg font-bold">{shop.name}</p>
          <p>Ticket {label}</p>
          <p>
            {new Intl.DateTimeFormat('fr', {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone: shop.timeZone,
            }).format(new Date(sale.occurredAt))}
          </p>
          {sale.customer && <p>Client : {sale.customer.name}</p>}
        </header>
        <ul className="flex flex-col gap-2 border-y border-dashed border-line-strong py-3">
          {sale.lines.map((line) => (
            <li key={line.position}>
              <p className="font-semibold">{line.label}</p>
              <Row
                label={`${formatQuantity(line.quantity, line.unit)} × ${money(line.unitPrice)}`}
                value={money(line.lineTotal)}
              />
            </li>
          ))}
        </ul>
        {sale.discount > 0 && (
          <Row label="Remise" value={`−${money(sale.discount)}`} />
        )}
        <Row label="TOTAL" value={money(sale.total)} strong />
        <div className="flex flex-col gap-1 border-t border-dashed border-line-strong pt-3">
          {sale.payments.map((payment, index) => (
            <Row
              key={index}
              label={`${PAYMENT_LABELS[payment.method]}${payment.provider ? ` (${PROVIDER_LABELS[payment.provider]})` : ''}`}
              value={money(payment.amount)}
            />
          ))}
          {sale.cashReceived !== null && (
            <Row label="Reçu" value={money(sale.cashReceived)} />
          )}
          {sale.changeGiven !== null && sale.changeGiven > 0 && (
            <Row label="Rendu" value={money(sale.changeGiven)} />
          )}
        </div>
        <p className="text-center">Merci de votre visite !</p>
      </article>

      <div className="flex flex-wrap justify-center gap-3 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className={buttonClasses('secondary')}
        >
          <Printer aria-hidden className="size-5" />
          Imprimer le ticket
        </button>
        <a
          href={whatsappLink(share, sale.customer?.phone)}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClasses('secondary')}
        >
          <MessageCircle aria-hidden className="size-5" />
          Envoyer sur WhatsApp
        </a>
      </div>
    </>
  );
}
