import type { SupplierDto } from '@nagaw/shared';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { apiAsUser } from '@/lib/api/server';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { ReferenceList } from '../reference-page';

export const metadata: Metadata = { title: 'Fournisseurs — Nagaw Business' };

async function Suppliers() {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const suppliers = await apiAsUser<SupplierDto[]>(workspace.accessToken, {
    path: '/suppliers',
    organizationId: workspace.organization.id,
  });
  return (
    <>
      <PageHeader
        title="Fournisseurs"
        description="Ceux chez qui vous achetez votre marchandise. Vous les choisissez quand vous recevez du stock."
      />
      <ReferenceList
        kind="supplier"
        workspace={workspace}
        items={suppliers}
        addTitle="Ajouter un fournisseur"
        addLabel="Ajouter le fournisseur"
        emptyTitle="Aucun fournisseur pour le moment"
        listLabel="Fournisseurs"
        describe={(supplier) =>
          supplier.phone ? (
            <a
              href={`tel:${supplier.phone.replace(/\s/g, '')}`}
              className="inline-flex min-h-12 items-center font-bold text-brand-ink underline underline-offset-4"
            >
              Appeler le {supplier.phone}
            </a>
          ) : (
            'Pas de téléphone'
          )
        }
      />
    </>
  );
}

export default function SuppliersPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Suppliers />
    </Suspense>
  );
}
