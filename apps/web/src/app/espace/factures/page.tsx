import {
  formatAmount,
  roleHasPermission,
  type DocumentListItemDto,
} from '@nagaw/shared';
import { FilePlus2, FileText } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button-link';
import { buttonClasses } from '@/components/ui/button-styles';
import { EmptyState } from '@/components/ui/empty-state';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { apiAsUser } from '@/lib/api/server';
import { documentBadge, documentTitle } from '@/lib/documents/labels';
import { formatCalendarDate } from '@/lib/format';
import { pageNumber, pageParams, pageRows } from '@/lib/pagination';
import { requireReadyWorkspace } from '@/lib/workspace/load';

export const metadata: Metadata = { title: 'Factures — Nagaw Business' };

async function Documents({ searchParams }: PageProps<'/espace/factures'>) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;
  const raw = await searchParams;
  const quotes = raw.type === 'devis';
  const page = pageNumber(raw.page);
  const base = quotes ? '/quotes' : '/invoices';
  const [documents, invoices] = await Promise.all([
    apiAsUser<DocumentListItemDto[]>(accessToken, {
      path: `${base}?${new URLSearchParams(pageParams(page))}`,
      organizationId: organization.id,
    }),
    // What is left to collect counts every invoice, not only this page.
    quotes
      ? null
      : apiAsUser<DocumentListItemDto[]>(accessToken, {
          path: base,
          organizationId: organization.id,
        }),
  ]);
  const list = documents.ok ? pageRows(documents.data) : null;
  const money = (value: number) =>
    formatAmount(value, organization.defaultCurrency);
  const canManage = roleHasPermission(organization.role, 'documents.manage');
  // Sellers prepare quotes; invoices stay with the managers (ADR-036).
  const canQuote = roleHasPermission(organization.role, 'quotes.manage');
  const owed = invoices?.ok
    ? invoices.data.reduce((sum, d) => sum + (d.balance ?? 0), 0)
    : 0;

  return (
    <>
      <PageHeader
        title="Factures et devis"
        description="Des documents propres, numérotés, à envoyer à vos clients."
        actions={
          canQuote && (
            <div className="flex flex-wrap gap-2">
              {canManage && (
                <ButtonLink href="/espace/factures/nouvelle">
                  <FilePlus2 aria-hidden className="size-5" />
                  Nouvelle facture
                </ButtonLink>
              )}
              <ButtonLink
                href="/espace/factures/devis/nouveau"
                variant={canManage ? 'secondary' : 'primary'}
              >
                <FileText aria-hidden className="size-5" />
                Nouveau devis
              </ButtonLink>
            </div>
          )
        }
      />
      <nav aria-label="Type de document" className="flex flex-wrap gap-2">
        <Link
          href="/espace/factures"
          aria-current={!quotes ? 'true' : undefined}
          className={buttonClasses(!quotes ? 'primary' : 'secondary')}
        >
          Factures
        </Link>
        <Link
          href="/espace/factures?type=devis"
          aria-current={quotes ? 'true' : undefined}
          className={buttonClasses(quotes ? 'primary' : 'secondary')}
        >
          Devis
        </Link>
      </nav>

      {!documents.ok ? (
        <Alert tone="error">
          Documents indisponibles : {documents.message}
        </Alert>
      ) : !list || list.rows.length === 0 ? (
        <EmptyState
          title={
            quotes
              ? 'Aucun devis pour le moment'
              : 'Aucune facture pour le moment'
          }
        >
          {quotes && canQuote
            ? 'Un devis donne un prix à un client avant qu’il commande.'
            : !quotes && canManage
              ? 'Créez une facture ici, ou depuis une vente avec le bouton « Faire une facture ».'
              : 'Les documents de la boutique apparaîtront ici.'}
        </EmptyState>
      ) : (
        <>
          {!quotes && owed > 0 && (
            <p className="text-lg font-bold">
              Reste à encaisser :{' '}
              <span className="text-warning-ink">{money(owed)}</span>
            </p>
          )}
          <ul
            aria-label={quotes ? 'Liste des devis' : 'Liste des factures'}
            className="flex flex-col gap-2"
          >
            {list.rows.map((doc) => {
              const badge = documentBadge(doc);
              const href =
                doc.kind === 'quote'
                  ? `/espace/factures/devis/${doc.id}`
                  : `/espace/factures/${doc.id}`;
              return (
                <li key={doc.id}>
                  <Link
                    href={href}
                    className="flex min-h-16 flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3"
                  >
                    <span className="flex flex-col">
                      <span className="font-bold">{documentTitle(doc)}</span>
                      <span className="text-ink-muted">
                        {doc.customerName} · {formatCalendarDate(doc.date)}
                      </span>
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <span className="font-bold tabular-nums">
                        {money(doc.total)}
                      </span>
                      <Badge tone={badge.tone}>{badge.label}</Badge>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <Pagination
        path="/espace/factures"
        params={new URLSearchParams(quotes ? { type: 'devis' } : {})}
        page={page}
        hasNext={list?.hasNext ?? false}
      />
    </>
  );
}

export default function DocumentsPage(props: PageProps<'/espace/factures'>) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Documents {...props} />
    </Suspense>
  );
}
