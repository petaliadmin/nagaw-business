import type { InvoiceDto } from '@nagaw/shared';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { PageFallback } from '@/components/ui/page-fallback';
import { apiAsUser } from '@/lib/api/server';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { EditorPage } from '../../editor-page';

export const metadata: Metadata = {
  title: 'Modifier la facture — Nagaw Business',
};

async function EditInvoice({
  params,
}: PageProps<'/espace/factures/[id]/modifier'>) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { id } = await params;
  const result = await apiAsUser<InvoiceDto>(workspace.accessToken, {
    path: `/invoices/${encodeURIComponent(id)}`,
    organizationId: workspace.organization.id,
  });
  if (!result.ok && result.status === 404) notFound();
  if (!result.ok)
    return <Alert tone="error">Facture indisponible : {result.message}</Alert>;
  const invoice = result.data;
  // Issued: never edited again (ADR-026).
  if (invoice.status !== 'draft') redirect(`/espace/factures/${invoice.id}`);
  return (
    <EditorPage
      workspace={workspace}
      kind="invoice"
      title="Modifier la facture"
      documentId={invoice.id}
      initial={{
        customerId: invoice.customer.id,
        lines: invoice.lines,
        discount: invoice.totals.discount,
        notes: invoice.notes,
        date: invoice.dueDate ?? '',
      }}
    />
  );
}

export default function EditInvoicePage(
  props: PageProps<'/espace/factures/[id]/modifier'>,
) {
  return (
    <Suspense fallback={<PageFallback />}>
      <EditInvoice {...props} />
    </Suspense>
  );
}
