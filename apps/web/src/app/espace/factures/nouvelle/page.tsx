import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageFallback } from '@/components/ui/page-fallback';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { EditorPage, EMPTY_LINE } from '../editor-page';

export const metadata: Metadata = {
  title: 'Nouvelle facture — Nagaw Business',
};

async function NewInvoice({
  searchParams,
}: PageProps<'/espace/factures/nouvelle'>) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const client = (await searchParams).client;
  return (
    <EditorPage
      workspace={workspace}
      kind="invoice"
      title="Nouvelle facture"
      initial={{
        customerId: typeof client === 'string' ? client : '',
        lines: [EMPTY_LINE],
        discount: 0,
        notes: '',
        date: '',
      }}
    />
  );
}

export default function NewInvoicePage(
  props: PageProps<'/espace/factures/nouvelle'>,
) {
  return (
    <Suspense fallback={<PageFallback />}>
      <NewInvoice {...props} />
    </Suspense>
  );
}
