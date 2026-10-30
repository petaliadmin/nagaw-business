import type { InvoiceDto } from '@nagaw/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { PdfViewer } from '@/components/pdf-viewer';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { apiAsUser } from '@/lib/api/server';
import { documentTitle } from '@/lib/documents/labels';
import { requireReadyWorkspace } from '@/lib/workspace/load';

export const metadata: Metadata = {
  title: 'Aperçu de la facture — Nagaw Business',
};

async function Preview({ params }: PageProps<'/espace/factures/[id]/apercu'>) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { id } = await params;
  const invoice = await apiAsUser<InvoiceDto>(workspace.accessToken, {
    path: `/invoices/${encodeURIComponent(id)}`,
    organizationId: workspace.organization.id,
  });
  if (!invoice.ok) notFound();
  const title = documentTitle(invoice.data);
  return (
    <>
      <PageHeader title={title} />
      <PdfViewer
        src={`/espace/factures/${id}/pdf`}
        fileName={invoice.data.number ?? 'facture-brouillon'}
        title={title}
      />
    </>
  );
}

export default function InvoicePreviewPage(
  props: PageProps<'/espace/factures/[id]/apercu'>,
) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Preview {...props} />
    </Suspense>
  );
}
