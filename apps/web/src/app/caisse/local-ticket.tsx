'use client';

import { describeSaleLine, type SaleDto } from '@nagaw/shared';
import { Check, CloudOff, Printer, ShoppingCart } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Alert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button-styles';
import { PAYMENT_LABELS, PROVIDER_LABELS } from '@/lib/sales/labels';
import { ticketLabel, ticketText } from '@/lib/sales/ticket';
import type { LocalTicket, ShopSnapshot } from '@/lib/offline/store';
import { SaleSteps } from './sale-steps';
import { ShareReceipt } from './share-receipt';

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
 * Ticket of a sale recorded on this device whose sending failed on the way
 * (ADR-057): printable and shareable, with its local number until the
 * server gives its own.
 */
export function LocalTicketView({
  ticket,
  sale,
  shop,
  money,
  justSold = false,
  onNext,
}: {
  ticket: LocalTicket;
  sale: SaleDto;
  shop: ShopSnapshot['shop'];
  money: (value: number) => string;
  /** Shown right after the sale: the last of its three steps. */
  justSold?: boolean;
  onNext: () => void;
}) {
  const label = ticketLabel(sale);
  const share = ticketText(sale, {
    name: shop.name,
    currency: shop.currency,
    timeZone: shop.timeZone,
  });
  // The « Valider la vente » button is gone: the confirmation takes the
  // focus, so that it is read at once (WCAG 2.4.3).
  const confirmationRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    confirmationRef.current?.focus();
  }, []);
  return (
    <>
      <style>
        {'@media print { @page { size: 58mm auto; margin: 2mm; } }'}
      </style>
      <div className="flex flex-col gap-3 print:hidden">
        {justSold && <SaleSteps step={3} label="Remettez le ticket" />}
        {/* The result in large, as a payment confirmed (ADR-063). */}
        <div
          ref={confirmationRef}
          tabIndex={-1}
          className="flex flex-col items-center gap-2 py-4 text-center focus:outline-none"
        >
          <span
            aria-hidden
            className="flex size-20 items-center justify-center rounded-full bg-sales-strong text-white ring-[10px] ring-sales-soft"
          >
            <Check className="size-10" strokeWidth={3} />
          </span>
          <p role="status" className="mt-3 text-2xl font-extrabold">
            Vente enregistrée.
          </p>
          <p className="text-4xl font-extrabold tracking-tight text-sales-ink tabular-nums">
            {money(sale.total)}
          </p>
          {sale.changeGiven !== null && sale.changeGiven > 0 && (
            <p className="rounded-full bg-warning-soft px-4 py-2 text-lg font-extrabold text-warning-ink">
              À rendre : {money(sale.changeGiven)}
            </p>
          )}
        </div>
        {ticket.status === 'pending' && (
          <p
            role="status"
            className="flex items-center gap-2 rounded-xl bg-warning-soft p-3 font-semibold text-warning-ink"
          >
            <CloudOff aria-hidden className="size-5 shrink-0" />
            Gardée sur ce téléphone : pas encore reçue en ligne. Elle partira
            toute seule, ne la refaites pas.
          </p>
        )}
        {ticket.status === 'rejected' && (
          <Alert tone="error">
            Vente refusée par le serveur : {ticket.reason}. Elle reste gardée
            sur ce téléphone.
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
        className="mx-auto flex w-full max-w-sm flex-col gap-3 rounded-3xl bg-surface p-5 font-mono text-base shadow-sm print:max-w-none print:border-0 print:p-0 print:text-sm print:shadow-none"
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
                label={describeSaleLine(line, money)}
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
        {/* A photo or a PDF of the ticket, made on the phone. */}
        <ShareReceipt
          text={share}
          fileName={`Ticket ${label.replace(/[^\w -]/g, '')}`}
        />
      </div>
    </>
  );
}
