import { FileText } from 'lucide-react';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ButtonLink } from '@/components/ui/button-link';
import { PageFallback } from '@/components/ui/page-fallback';
import { DocumentList } from '../document-list';

export const metadata: Metadata = { title: 'Devis — Nagaw Business' };

async function Quotes({ searchParams }: PageProps<'/espace/factures/devis'>) {
  return (
    <DocumentList
      kind="quotes"
      title="Devis"
      description="Vos propositions de prix, avant que le client commande."
      page={(await searchParams).page}
      action={(canQuote) =>
        canQuote && (
          <ButtonLink href="/espace/factures/devis/nouveau">
            <FileText aria-hidden className="size-5" />
            Nouveau devis
          </ButtonLink>
        )
      }
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
