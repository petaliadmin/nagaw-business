import { roleHasPermission } from '@nagaw/shared';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { PageFallback } from '@/components/ui/page-fallback';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { DocumentList } from './document-list';
import { NewDocumentFab, NewDocumentMenuFab } from './new-document-fab';

export const metadata: Metadata = {
  title: 'Factures et devis — Nagaw Business',
};

/**
 * « Factures et devis » opens on what is left to collect (V3, ADR-063):
 * the invoices still owed, the most useful list, before all the others.
 */
async function ToCollect({ searchParams }: PageProps<'/espace/factures'>) {
  const params = await searchParams;
  // Former address of the list of quotes.
  if (params.type === 'devis') redirect('/espace/factures/devis');
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  // What the shop is owed in total is not for sellers (ADR-036).
  if (!roleHasPermission(workspace.organization.role, 'stats.read'))
    redirect('/espace/factures/liste');
  return (
    <DocumentList
      kind="invoices"
      owing
      title="Factures et devis"
      description="Les factures qu’on vous doit encore, en premier."
      page={params.page}
      fab={(canQuote, canManage) =>
        canManage && canQuote ? (
          <NewDocumentMenuFab />
        ) : canManage ? (
          <NewDocumentFab kind="invoice" />
        ) : canQuote ? (
          <NewDocumentFab kind="quote" />
        ) : null
      }
      empty={() =>
        'Toutes vos factures émises sont payées. Les autres sont dans « Toutes ».'
      }
    />
  );
}

export default function DocumentsPage(props: PageProps<'/espace/factures'>) {
  return (
    <Suspense fallback={<PageFallback variant="list" />}>
      <ToCollect {...props} />
    </Suspense>
  );
}
