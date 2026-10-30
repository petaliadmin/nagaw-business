import { FilePlus2 } from 'lucide-react';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ButtonLink } from '@/components/ui/button-link';
import { PageFallback } from '@/components/ui/page-fallback';
import { DocumentList } from '../document-list';

export const metadata: Metadata = { title: 'Factures — Nagaw Business' };

async function Invoices({ searchParams }: PageProps<'/espace/factures/liste'>) {
  return (
    <DocumentList
      kind="invoices"
      title="Factures"
      description="Des documents propres, numérotés, à envoyer à vos clients."
      page={(await searchParams).page}
      action={(_canQuote, canManage) =>
        canManage && (
          <ButtonLink href="/espace/factures/nouvelle">
            <FilePlus2 aria-hidden className="size-5" />
            Nouvelle facture
          </ButtonLink>
        )
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
    <Suspense fallback={<PageFallback />}>
      <Invoices {...props} />
    </Suspense>
  );
}
