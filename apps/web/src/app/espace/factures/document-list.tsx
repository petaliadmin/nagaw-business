import {
  formatAmount,
  roleHasPermission,
  type DocumentListItemDto,
  type DocumentStatsDto,
} from '@nagaw/shared';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { apiAsUser } from '@/lib/api/server';
import { documentBadge, documentTitle } from '@/lib/documents/labels';
import { formatCalendarDate } from '@/lib/format';
import { pageNumber, pageParams, pageRows } from '@/lib/pagination';
import { requireReadyWorkspace } from '@/lib/workspace/load';

/** The list of the invoices or of the quotes of the shop, by pages. */
export async function DocumentList({
  kind,
  title,
  description,
  page: rawPage,
  action,
  empty,
}: {
  kind: 'invoices' | 'quotes';
  title: string;
  description: string;
  page: string | string[] | undefined;
  action: (canQuote: boolean, canManage: boolean) => ReactNode;
  empty: (canQuote: boolean, canManage: boolean) => string;
}) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;
  const page = pageNumber(rawPage);
  const quotes = kind === 'quotes';
  const [documents, stats] = await Promise.all([
    apiAsUser<DocumentListItemDto[]>(accessToken, {
      path: `/${kind}?${new URLSearchParams(pageParams(page))}`,
      organizationId: organization.id,
    }),
    // What is left to collect counts every invoice, not only this page.
    quotes || !roleHasPermission(organization.role, 'stats.read')
      ? null
      : apiAsUser<DocumentStatsDto>(accessToken, {
          path: '/documents/stats',
          organizationId: organization.id,
        }),
  ]);
  const list = documents.ok ? pageRows(documents.data) : null;
  const money = (value: number) =>
    formatAmount(value, organization.defaultCurrency);
  const canManage = roleHasPermission(organization.role, 'documents.manage');
  // Sellers prepare quotes; invoices stay with the managers (ADR-036).
  const canQuote = roleHasPermission(organization.role, 'quotes.manage');
  const owed = stats?.ok ? stats.data.invoices.balance : 0;

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={action(canQuote, canManage)}
      />

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
          {empty(canQuote, canManage)}
        </EmptyState>
      ) : (
        <>
          {owed > 0 && (
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
                    <span className="flex min-w-0 flex-col">
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
        path={quotes ? '/espace/factures/devis' : '/espace/factures/liste'}
        params={new URLSearchParams()}
        page={page}
        hasNext={list?.hasNext ?? false}
      />
    </>
  );
}
