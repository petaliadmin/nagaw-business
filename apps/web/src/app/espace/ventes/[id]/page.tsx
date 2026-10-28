import {
  formatAmount,
  formatRate,
  describeSaleLine,
  roleHasPermission,
  type CustomerDto,
  type SaleDto,
} from '@nagaw/shared';
import { FileText, MessageCircle, ShoppingCart, Undo2 } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button-link';
import { buttonClasses } from '@/components/ui/button-styles';
import { Card } from '@/components/ui/card';
import { PageFallback } from '@/components/ui/page-fallback';
import { apiAsUser } from '@/lib/api/server';
import { formatDateTime } from '@/lib/format';
import { PAYMENT_LABELS, PROVIDER_LABELS } from '@/lib/sales/labels';
import { ticketLabel, ticketText, whatsappLink } from '@/lib/sales/ticket';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { InvoiceFromSaleForm } from '../../factures/document-actions';
import { CancelSaleForm, PrintButton } from './ticket-actions';

export const metadata: Metadata = { title: 'Vente — Nagaw Business' };

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

async function Sale({
  params,
  searchParams,
}: PageProps<'/espace/ventes/[id]'>) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;
  const { id } = await params;
  const isNew = (await searchParams).nouvelle === '1';
  const sale = await apiAsUser<SaleDto>(accessToken, {
    path: `/sales/${encodeURIComponent(id)}`,
    organizationId: organization.id,
  });
  if (!sale.ok && sale.status === 404) notFound();
  if (!sale.ok)
    return <Alert tone="error">Vente indisponible : {sale.message}</Alert>;

  const s = sale.data;
  const currency = organization.defaultCurrency;
  const money = (value: number) => formatAmount(value, currency);
  const canCancel =
    s.status === 'completed' &&
    roleHasPermission(organization.role, 'sales.cancel');
  // A sale paid at the counter can get an invoice (ADR-026); on credit, not.
  const canInvoice =
    s.status === 'completed' &&
    !s.payments.some((p) => p.method === 'credit') &&
    roleHasPermission(organization.role, 'documents.manage');
  const customers =
    canInvoice && !s.customer
      ? await apiAsUser<CustomerDto[]>(accessToken, {
          path: '/customers',
          organizationId: organization.id,
        })
      : null;
  const share = ticketText(s, {
    name: organization.name,
    currency,
    timeZone: organization.timezone,
  });

  return (
    <>
      {/* Thermal printers use 58 mm paper. */}
      <style>
        {'@media print { @page { size: 58mm auto; margin: 2mm; } }'}
      </style>
      <div className="flex flex-col gap-4 print:hidden">
        {isNew && s.status === 'completed' && (
          <Alert tone="success">
            Vente enregistrée.
            {s.changeGiven !== null && s.changeGiven > 0 && (
              <strong className="block text-2xl">
                À rendre : {money(s.changeGiven)}
              </strong>
            )}
          </Alert>
        )}
        {s.priceReview && (
          <Alert tone="warning">
            Prix à vérifier : cette vente a été faite sans connexion à des prix
            différents de ceux du catalogue au moment de son envoi.
          </Alert>
        )}
        {s.stockReview && (
          <Alert tone="warning">
            Stock à vérifier : cette vente a pris plus d’articles que le stock
            enregistré. Comptez le rayon et corrigez le stock si besoin.
          </Alert>
        )}
        {s.status === 'cancelled' && s.cancellation && (
          <Alert tone="warning">
            Vente annulée le{' '}
            {formatDateTime(s.cancellation.at, organization.timezone)} par{' '}
            {s.cancellation.by.email} : {s.cancellation.reason}
          </Alert>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold md:text-3xl">
            Ticket {ticketLabel(s)}
          </h1>
          <ButtonLink href="/caisse">
            <ShoppingCart aria-hidden className="size-5" />
            Nouvelle vente
          </ButtonLink>
        </div>
      </div>

      <article
        aria-label={`Ticket ${ticketLabel(s)}`}
        className="mx-auto flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-line bg-surface p-5 font-mono text-base shadow-sm print:max-w-none print:border-0 print:p-0 print:text-sm print:shadow-none"
      >
        <header className="text-center">
          <p className="text-lg font-bold">{organization.name}</p>
          <p>Ticket {ticketLabel(s)}</p>
          <p>{formatDateTime(s.occurredAt, organization.timezone)}</p>
          {s.customer && <p>Client : {s.customer.name}</p>}
        </header>
        <ul className="flex flex-col gap-2 border-y border-dashed border-line-strong py-3">
          {s.lines.map((line) => (
            <li key={line.position}>
              <p className="font-semibold">{line.label}</p>
              <Row
                label={describeSaleLine(line, money)}
                value={money(line.lineTotal)}
              />
              {line.lineTotal !== line.listTotal && (
                <p className="text-ink-muted">
                  Prix convenu avec le client, au lieu de{' '}
                  {money(line.listTotal)}
                </p>
              )}
            </li>
          ))}
        </ul>
        {s.discount > 0 && (
          <Row label="Remise" value={`−${money(s.discount)}`} />
        )}
        <Row label="TOTAL" value={money(s.total)} strong />
        {s.taxTotal > 0 && (
          <p className="text-ink-muted print:text-ink">
            Dont taxes : {money(s.taxTotal)}
            {[
              ...new Set(
                s.lines
                  .map((l) => l.taxRateBasisPoints)
                  .filter((r) => r !== null),
              ),
            ]
              .map((r) => ` (${formatRate(r!)})`)
              .join('')}
          </p>
        )}
        <div className="flex flex-col gap-1 border-t border-dashed border-line-strong pt-3">
          {s.payments.map((payment, index) => (
            <Row
              key={index}
              label={`${PAYMENT_LABELS[payment.method]}${payment.provider ? ` (${PROVIDER_LABELS[payment.provider]})` : ''}`}
              value={money(payment.amount)}
            />
          ))}
          {s.cashReceived !== null && (
            <Row label="Reçu" value={money(s.cashReceived)} />
          )}
          {s.changeGiven !== null && s.changeGiven > 0 && (
            <Row label="Rendu" value={money(s.changeGiven)} />
          )}
        </div>
        {s.status === 'cancelled' && (
          <p className="text-center text-lg font-extrabold">VENTE ANNULÉE</p>
        )}
        <p className="text-center">Merci de votre visite !</p>
      </article>

      <div className="flex flex-wrap justify-center gap-3 print:hidden">
        <PrintButton />
        <a
          href={whatsappLink(share, s.customer?.phone)}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClasses('secondary')}
        >
          <MessageCircle aria-hidden className="size-5" />
          Envoyer sur WhatsApp
        </a>
      </div>
      <p className="text-center text-ink-muted print:hidden">
        Vendu par {s.seller.email}. L’impression passe par l’imprimante de votre
        téléphone ou de votre ordinateur ; l’impression Bluetooth directe sera
        ajoutée après les essais sur vos imprimantes.
      </p>

      {canInvoice && (
        <div className="print:hidden">
          <Card
            title="Facture de cette vente"
            titleId="sale-invoice"
            icon={FileText}
          >
            <p className="mb-4 text-ink-muted">
              Pour un client qui demande une facture : elle reprend les articles
              du ticket et sera marquée payée.
            </p>
            {customers && !customers.ok ? (
              <Alert tone="error">
                Clients indisponibles : {customers.message}
              </Alert>
            ) : (
              <InvoiceFromSaleForm
                organizationId={organization.id}
                saleId={s.id}
                customers={
                  customers
                    ? customers.data
                        .filter((c) => c.status === 'active')
                        .map((c) => ({ id: c.id, name: c.name }))
                    : null
                }
              />
            )}
          </Card>
        </div>
      )}

      {canCancel && (
        <div className="print:hidden">
          <Card title="Annuler cette vente" titleId="cancel-sale" icon={Undo2}>
            <p className="mb-4 text-ink-muted">
              Les articles reviennent dans le stock et le crédit éventuel du
              client est effacé. L’annulation est définitive et reste dans
              l’historique.
            </p>
            <CancelSaleForm organizationId={organization.id} saleId={s.id} />
          </Card>
        </div>
      )}
    </>
  );
}

export default function SalePage(props: PageProps<'/espace/ventes/[id]'>) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Sale {...props} />
    </Suspense>
  );
}
