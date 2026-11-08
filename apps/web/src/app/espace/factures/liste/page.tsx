import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageFallback } from '@/components/ui/page-fallback';
import { DocumentList } from '../document-list';
import { NewDocumentFab } from '../new-document-fab';

export const metadata: Metadata = { title: 'Factures — Nagaw Business' };

async function Invoices({ searchParams }: PageProps<'/espace/factures/liste'>) {
  return (
    <DocumentList
      kind="invoices"
      title="Factures"
      description="Des documents propres, numérotés, à envoyer à vos clients."
      page={(await searchParams).page}
      fab={(_canQuote, canManage) =>
        canManage && <NewDocumentFab kind="invoice" />
      }
      empty={(_canQuote, canManage) =>
        canManage
          ? 'Créez une facture ici, ou depuis une vente avec le bouton « Faire une facture ».'
          : 'Les factures de la boutique apparaîtront ici.'
      }
    />
  );
}

export default function InvoicesPage(
  props: PageProps<'/espace/factures/liste'>,
) {
  return (
    <Suspense fallback={<PageFallback variant="list" />}>
      <Invoices {...props} />
    </Suspense>
  );
}
