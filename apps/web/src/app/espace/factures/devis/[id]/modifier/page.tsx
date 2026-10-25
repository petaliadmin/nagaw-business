import type { QuoteDto } from '@nagaw/shared';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { PageFallback } from '@/components/ui/page-fallback';
import { apiAsUser } from '@/lib/api/server';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { EditorPage } from '../../../editor-page';

export const metadata: Metadata = {
  title: 'Modifier le devis — Nagaw Business',
};

async function EditQuote({
  params,
}: PageProps<'/espace/factures/devis/[id]/modifier'>) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { id } = await params;
  const result = await apiAsUser<QuoteDto>(workspace.accessToken, {
    path: `/quotes/${encodeURIComponent(id)}`,
    organizationId: workspace.organization.id,
  });
  if (!result.ok && result.status === 404) notFound();
  if (!result.ok)
    return <Alert tone="error">Devis indisponible : {result.message}</Alert>;
  const quote = result.data;
  // Sent to the customer: kept as it was sent.
  if (quote.status !== 'draft') redirect(`/espace/factures/devis/${quote.id}`);
  return (
    <EditorPage
      workspace={workspace}
      kind="quote"
      title={`Modifier le devis ${quote.number}`}
      documentId={quote.id}
      initial={{
        customerId: quote.customer.id,
        lines: quote.lines,
        discount: quote.totals.discount,
        notes: quote.notes,
        date: quote.validUntil,
      }}
    />
  );
}

export default function EditQuotePage(
  props: PageProps<'/espace/factures/devis/[id]/modifier'>,
) {
  return (
    <Suspense fallback={<PageFallback />}>
      <EditQuote {...props} />
    </Suspense>
  );
}
