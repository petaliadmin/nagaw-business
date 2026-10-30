import {
  canChangeQuoteStatus,
  roleHasPermission,
  type QuoteDto,
} from '@nagaw/shared';
import { Eye, Pencil } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button-link';
import { Card } from '@/components/ui/card';
import { PageFallback } from '@/components/ui/page-fallback';
import { ShopLogo } from '@/components/ui/shop-logo';
import { apiAsUser } from '@/lib/api/server';
import { documentBadge } from '@/lib/documents/labels';
import { formatCalendarDate } from '@/lib/format';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import {
  InvoiceFromQuoteForm,
  QuoteStatusForm,
  SharePdfButton,
} from '../../document-actions';
import { CustomerBlock, DocumentBody } from '../../document-view';

export const metadata: Metadata = { title: 'Devis — Nagaw Business' };

async function Quote({ params }: PageProps<'/espace/factures/devis/[id]'>) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;
  const { id } = await params;
  const result = await apiAsUser<QuoteDto>(accessToken, {
    path: `/quotes/${encodeURIComponent(id)}`,
    organizationId: organization.id,
  });
  if (!result.ok && result.status === 404) notFound();
  if (!result.ok)
    return <Alert tone="error">Devis indisponible : {result.message}</Alert>;

  const quote = result.data;
  const canManage = roleHasPermission(organization.role, 'documents.manage');
  const canQuote = roleHasPermission(organization.role, 'quotes.manage');
  const badge = documentBadge({
    kind: 'quote',
    status: quote.status,
    paymentState: null,
    expired: quote.expired,
    overdue: false,
  });
  const next = (['sent', 'accepted', 'refused'] as const).filter((status) =>
    canChangeQuoteStatus(quote.status, status),
  );
  const pdfHref = `/espace/factures/devis/${quote.id}/pdf`;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <ShopLogo version={organization.logoVersion} />
          <h1 className="text-2xl font-extrabold md:text-3xl">
            Devis {quote.number}
          </h1>
          <div>
            <Badge tone={badge.tone}>{badge.label}</Badge>
          </div>
        </div>
      </div>

      {quote.expired && (
        <Alert tone="warning">
          Ce devis n’est plus valable depuis le{' '}
          {formatCalendarDate(quote.validUntil)}.
          {quote.status === 'draft' && ' Modifiez sa date pour le prolonger.'}
        </Alert>
      )}
      {quote.invoice && (
        <Alert tone="success">
          Facturé :{' '}
          <Link
            href={`/espace/factures/${quote.invoice.id}`}
            className="font-bold underline"
          >
            {quote.invoice.number
              ? `facture ${quote.invoice.number}`
              : 'voir la facture (brouillon)'}
          </Link>
          .
        </Alert>
      )}

      <Card>
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <CustomerBlock customer={quote.customer} />
            <dl className="flex flex-col gap-0.5">
              <div className="flex gap-2">
                <dt className="text-ink-muted">Date :</dt>
                <dd>{formatCalendarDate(quote.issueDate)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-ink-muted">Valable jusqu’au :</dt>
                <dd>{formatCalendarDate(quote.validUntil)}</dd>
              </div>
            </dl>
          </div>
          <DocumentBody
            lines={quote.lines}
            totals={quote.totals}
            notes={quote.notes}
            currency={organization.defaultCurrency}
          />
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        <ButtonLink
          href={`/espace/factures/devis/${quote.id}/apercu`}
          variant="secondary"
        >
          <Eye aria-hidden className="size-5" />
          Voir le PDF
        </ButtonLink>
        <SharePdfButton href={pdfHref} fileName={quote.number} />
        {canQuote && quote.status === 'draft' && (
          <ButtonLink
            href={`/espace/factures/devis/${quote.id}/modifier`}
            variant="secondary"
          >
            <Pencil aria-hidden className="size-5" />
            Modifier
          </ButtonLink>
        )}
      </div>

      {canQuote && next.length > 0 && (
        <Card title="Réponse du client" titleId="quote-status">
          <QuoteStatusForm
            organizationId={organization.id}
            quoteId={quote.id}
            next={[...next]}
          />
        </Card>
      )}
      {canManage && quote.status === 'accepted' && !quote.invoice && (
        <Card title="Facturer" titleId="quote-invoice">
          <p className="mb-4 text-ink-muted">
            La facture reprend les lignes du devis. Vous pourrez la vérifier
            avant de l’émettre.
          </p>
          <InvoiceFromQuoteForm
            organizationId={organization.id}
            quoteId={quote.id}
          />
        </Card>
      )}
    </>
  );
}

export default function QuotePage(
  props: PageProps<'/espace/factures/devis/[id]'>,
) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Quote {...props} />
    </Suspense>
  );
}
