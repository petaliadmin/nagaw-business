import { roleHasPermission, type SupplierDto } from '@nagaw/shared';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { apiAsUser } from '@/lib/api/server';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { NewSupplierFab } from './new-supplier-fab';
import { SupplierRow } from './supplier-row';

export const metadata: Metadata = { title: 'Fournisseurs — Nagaw Business' };

async function Suppliers() {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization } = workspace;
  const suppliers = await apiAsUser<SupplierDto[]>(workspace.accessToken, {
    path: '/suppliers',
    organizationId: organization.id,
  });
  const canManage = roleHasPermission(organization.role, 'catalog.manage');
  // Removed suppliers stay below, to be put back.
  const sorted = suppliers.ok
    ? [...suppliers.data].sort(
        (a, b) =>
          Number(a.status === 'archived') - Number(b.status === 'archived'),
      )
    : [];
  return (
    <>
      <PageHeader
        title="Fournisseurs"
        description="Ceux chez qui vous achetez votre marchandise. Vous les choisissez quand vous recevez du stock."
      />
      {!suppliers.ok ? (
        <Alert tone="error">Liste indisponible : {suppliers.message}</Alert>
      ) : sorted.length === 0 ? (
        <EmptyState title="Aucun fournisseur pour le moment" />
      ) : (
        <ul aria-label="Fournisseurs" className="flex flex-col gap-2">
          {sorted.map((supplier) => (
            <SupplierRow
              key={supplier.id}
              supplier={supplier}
              organizationId={organization.id}
              countryCode={organization.phoneCountryCode}
              canManage={canManage}
            />
          ))}
        </ul>
      )}
      {canManage && <NewSupplierFab organizationId={organization.id} />}
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
