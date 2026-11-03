import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageFallback } from '@/components/ui/page-fallback';
import { DocumentList } from '../document-list';
import { NewDocumentFab } from '../new-document-fab';

export const metadata: Metadata = { title: 'Devis — Nagaw Business' };

async function Quotes({ searchParams }: PageProps<'/espace/factures/devis'>) {
  return (
    <DocumentList
      kind="quotes"
      title="Devis"
      description="Vos propositions de prix, avant que le client commande."
      page={(await searchParams).page}
      fab={(canQuote) => canQuote && <NewDocumentFab kind="quote" />}
      empty={(canQuote) =>
        canQuote
          ? 'Un devis donne un prix à un client avant qu’il commande.'
          : 'Les devis de la boutique apparaîtront ici.'
      }
    />
  );
}

export default function QuotesPage(props: PageProps<'/espace/factures/devis'>) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Quotes {...props} />
    </Suspense>
  );
}
