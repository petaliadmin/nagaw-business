import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageFallback } from '@/components/ui/page-fallback';
import { todayIn } from '@/lib/format';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { EditorPage, EMPTY_LINE } from '../../editor-page';

export const metadata: Metadata = { title: 'Nouveau devis — Nagaw Business' };

function addDays(day: string, n: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

async function NewQuote({
  searchParams,
}: PageProps<'/espace/factures/devis/nouveau'>) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization } = workspace;
  const client = (await searchParams).client;
  return (
    <EditorPage
      workspace={workspace}
      kind="quote"
      title="Nouveau devis"
      initial={{
        customerId: typeof client === 'string' ? client : '',
        lines: [EMPTY_LINE],
        discount: 0,
        notes: '',
        date: addDays(
          todayIn(organization.timezone),
          organization.quoteValidityDays,
        ),
      }}
    />
  );
}

export default function NewQuotePage(
  props: PageProps<'/espace/factures/devis/nouveau'>,
) {
  return (
    <Suspense fallback={<PageFallback />}>
      <NewQuote {...props} />
    </Suspense>
  );
}
