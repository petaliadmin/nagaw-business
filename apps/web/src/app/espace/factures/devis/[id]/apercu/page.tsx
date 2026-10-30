import type { QuoteDto } from '@nagaw/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { PdfViewer } from '@/components/pdf-viewer';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { apiAsUser } from '@/lib/api/server';
import { requireReadyWorkspace } from '@/lib/workspace/load';

export const metadata: Metadata = {
  title: 'Aperçu du devis — Nagaw Business',
};

async function Preview({
  params,
}: PageProps<'/espace/factures/devis/[id]/apercu'>) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { id } = await params;
  const quote = await apiAsUser<QuoteDto>(workspace.accessToken, {
    path: `/quotes/${encodeURIComponent(id)}`,
    organizationId: workspace.organization.id,
  });
  if (!quote.ok) notFound();
  const title = `Devis ${quote.data.number}`;
  return (
    <>
      <PageHeader title={title} />
      <PdfViewer
        src={`/espace/factures/devis/${id}/pdf`}
        fileName={quote.data.number}
        title={title}
      />
    </>
  );
}

export default function QuotePreviewPage(
  props: PageProps<'/espace/factures/devis/[id]/apercu'>,
) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Preview {...props} />
    </Suspense>
  );
}
