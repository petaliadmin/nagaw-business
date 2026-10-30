import {
  formatAmount,
  roleHasPermission,
  type InvoiceDto,
} from '@nagaw/shared';
import { Banknote, FileDown, Pencil, Undo2 } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button-link';
import { buttonClasses } from '@/components/ui/button-styles';
import { Card } from '@/components/ui/card';
import { PageFallback } from '@/components/ui/page-fallback';
import { ShopLogo } from '@/components/ui/shop-logo';
import { apiAsUser } from '@/lib/api/server';
import {
  documentBadge,
  documentTitle,
  INVOICE_PAYMENT_LABELS,
} from '@/lib/documents/labels';
import { formatCalendarDate, formatDateTime, todayIn } from '@/lib/format';
import { PROVIDER_LABELS, ticketNumber } from '@/lib/sales/labels';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import {
  CancelInvoiceForm,
  IssueInvoiceForm,
  PaymentForm,
  SharePdfButton,
} from '../document-actions';
import { CustomerBlock, DocumentBody } from '../document-view';

export const metadata: Metadata = { title: 'Facture — Nagaw Business' };

async function Invoice({ params }: PageProps<'/espace/factures/[id]'>) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;
  const { id } = await params;
  const result = await apiAsUser<InvoiceDto>(accessToken, {
    path: `/invoices/${encodeURIComponent(id)}`,
    organizationId: organization.id,
  });
  if (!result.ok && result.status === 404) notFound();
  if (!result.ok)
    return <Alert tone="error">Facture indisponible : {result.message}</Alert>;

  const invoice = result.data;
  const currency = organization.defaultCurrency;
  const money = (value: number) => formatAmount(value, currency);
  const canManage = roleHasPermission(organization.role, 'documents.manage');
  const isInvoice = invoice.kind === 'invoice';
  const open = isInvoice && invoice.status === 'issued';
  const badge = documentBadge({ ...invoice, expired: false });
  const title = documentTitle(invoice);
  const pdfHref = `/espace/factures/${invoice.id}/pdf`;
  const receivedPayments = invoice.payments.some((p) => !p.fromSale);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <ShopLogo version={organization.logoVersion} />
          <h1 className="text-2xl font-extrabold md:text-3xl">{title}</h1>
          <div>
            <Badge tone={badge.tone}>{badge.label}</Badge>
          </div>
        </div>
        <Link
          href="/espace/factures"
          className="font-semibold text-brand-ink underline underline-offset-4"
        >
          Toutes les factures
        </Link>
      </div>

      {invoice.status === 'draft' && (
        <Alert>
          Brouillon : vous pouvez encore le modifier. La facture reçoit son
          numéro quand vous l’émettez, et ne change plus ensuite.
        </Alert>
      )}
      {invoice.status === 'cancelled' && invoice.cancellation && (
        <Alert tone="warning">
          Facture annulée le{' '}
          {formatDateTime(invoice.cancellation.at, organization.timezone)} :{' '}
          {invoice.cancellation.reason}.
          {invoice.creditNote && (
            <>
              {' '}
              <Link
                href={`/espace/factures/${invoice.creditNote.id}`}
                className="font-bold underline"
              >
                Voir l’avoir {invoice.creditNote.number}
              </Link>
            </>
          )}
        </Alert>
      )}
      {invoice.creditFor && (
        <Alert>
          Cet avoir annule la facture{' '}
          <Link
            href={`/espace/factures/${invoice.creditFor.id}`}
            className="font-bold underline"
          >
            {invoice.creditFor.number}
          </Link>
          .
        </Alert>
      )}
      {invoice.overdue && (
        <Alert tone="error">
          En retard : elle devait être payée avant le{' '}
          {formatCalendarDate(invoice.dueDate!)}.
        </Alert>
      )}

      <Card>
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <CustomerBlock customer={invoice.customer} />
            <dl className="flex flex-col gap-0.5">
              {invoice.issueDate && (
                <div className="flex gap-2">
                  <dt className="text-ink-muted">Date :</dt>
                  <dd>{formatCalendarDate(invoice.issueDate)}</dd>
                </div>
              )}
              {isInvoice && invoice.dueDate && (
                <div className="flex gap-2">
                  <dt className="text-ink-muted">À payer avant le :</dt>
                  <dd>{formatCalendarDate(invoice.dueDate)}</dd>
                </div>
              )}
              {invoice.quote && (
                <div className="flex gap-2">
                  <dt className="text-ink-muted">Devis :</dt>
                  <dd>
                    <Link
                      href={`/espace/factures/devis/${invoice.quote.id}`}
                      className="font-semibold underline"
                    >
                      {invoice.quote.number}
                    </Link>
                  </dd>
                </div>
              )}
              {invoice.sale && (
                <div className="flex gap-2">
                  <dt className="text-ink-muted">Vente :</dt>
                  <dd>
                    <Link
                      href={`/espace/ventes/${invoice.sale.id}`}
                      className="font-semibold underline"
                    >
                      Ticket {ticketNumber(invoice.sale.saleNumber)}
                    </Link>
                  </dd>
                </div>
              )}
            </dl>
          </div>
          <DocumentBody
            lines={invoice.lines}
            totals={invoice.totals}
            notes={invoice.notes}
            currency={currency}
            extraRows={
              open
                ? [
                    { label: 'Déjà payé', value: invoice.paid },
                    {
                      label: 'Reste à payer',
                      value: invoice.balance,
                      strong: true,
                    },
                  ]
                : []
            }
          />
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        <a
          href={pdfHref}
          target="_blank"
          rel="noopener"
          className={buttonClasses('secondary')}
        >
          <FileDown aria-hidden className="size-5" />
          Ouvrir le PDF
        </a>
        <SharePdfButton
          href={pdfHref}
          fileName={invoice.number ?? 'facture-brouillon'}
        />
        {canManage && invoice.status === 'draft' && (
          <ButtonLink
            href={`/espace/factures/${invoice.id}/modifier`}
            variant="secondary"
          >
            <Pencil aria-hidden className="size-5" />
            Modifier
          </ButtonLink>
        )}
      </div>

      {canManage && invoice.status === 'draft' && (
        <Card title="Émettre la facture" titleId="issue-invoice">
          <p className="mb-4 text-ink-muted">
            Vérifiez le client et les montants : une fois émise, la facture
            reçoit son numéro et ne peut plus être modifiée.
            {invoice.sale &&
              ' Elle est marquée payée : la vente a été réglée en caisse.'}
          </p>
          <IssueInvoiceForm
            organizationId={organization.id}
            invoiceId={invoice.id}
          />
        </Card>
      )}

      {isInvoice && invoice.payments.length > 0 && (
        <Card title="Paiements reçus" titleId="payments" icon={Banknote}>
          <ul className="flex flex-col divide-y divide-line">
            {invoice.payments.map((payment) => (
              <li
                key={payment.id}
                className="flex flex-wrap justify-between gap-3 py-3 first:pt-0"
              >
                <span>
                  {formatCalendarDate(payment.paidOn)} ·{' '}
                  {INVOICE_PAYMENT_LABELS[payment.method]}
                  {payment.provider
                    ? ` (${PROVIDER_LABELS[payment.provider]})`
                    : ''}
                  {payment.reference ? ` · ${payment.reference}` : ''}
                  {payment.fromSale ? ' · réglé en caisse' : ''}
                </span>
                <span className="font-bold tabular-nums">
                  {money(payment.amount)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {canManage && open && invoice.balance > 0 && (
        <Card
          title="Enregistrer un paiement"
          titleId="add-payment"
          icon={Banknote}
        >
          <PaymentForm
            organizationId={organization.id}
            invoiceId={invoice.id}
            currency={currency}
            balance={invoice.balance}
            today={todayIn(organization.timezone)}
          />
        </Card>
      )}

      {canManage && open && (
        <Card
          title="Annuler cette facture"
          titleId="cancel-invoice"
          icon={Undo2}
        >
          {receivedPayments ? (
            <Alert>
              Cette facture a déjà reçu des paiements : remboursez d’abord le
              client. Une facture se corrige par un avoir, jamais en la
              modifiant.
            </Alert>
          ) : (
            <>
              <p className="mb-4 text-ink-muted">
                Une facture émise ne se supprime pas : un avoir du même montant
                l’annule, et les deux restent dans vos documents.
              </p>
              <CancelInvoiceForm
                organizationId={organization.id}
                invoiceId={invoice.id}
              />
            </>
          )}
        </Card>
      )}
    </>
  );
}

export default function InvoicePage(props: PageProps<'/espace/factures/[id]'>) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Invoice {...props} />
    </Suspense>
  );
}
