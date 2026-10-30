import {
  roleHasPermission,
  type CategoryDto,
  type TaxRateDto,
} from '@nagaw/shared';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { apiAsUser } from '@/lib/api/server';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { CATALOG_NOUNS } from '@/lib/catalog/offer';
import { ProductForm } from '../product-form';

export const metadata: Metadata = {
  title: 'Ajouter un produit ou un service — Nagaw Business',
};

async function NewProduct() {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;
  const header = (
    <PageHeader
      title={`Ajouter un ${CATALOG_NOUNS[organization.offer]}`}
      description="Seuls le nom et le prix sont obligatoires. Vous pourrez tout modifier ensuite."
    />
  );
  if (!roleHasPermission(organization.role, 'catalog.manage')) {
    return (
      <>
        {header}
        <Alert>
          Seuls le propriétaire et les gérants ajoutent des produits et des
          services.
        </Alert>
      </>
    );
  }

  const [categories, taxRates] = await Promise.all([
    apiAsUser<CategoryDto[]>(accessToken, {
      path: '/product-categories',
      organizationId: organization.id,
    }),
    apiAsUser<TaxRateDto[]>(accessToken, {
      path: '/tax-rates',
      organizationId: organization.id,
    }),
  ]);
  if (!categories.ok || !taxRates.ok) {
    const failed = !categories.ok ? categories : taxRates;
    return (
      <>
        {header}
        <Alert tone="error">
          Formulaire indisponible : {!failed.ok && failed.message}
        </Alert>
      </>
    );
  }

  return (
    <>
      {header}
      <Card>
        <ProductForm
          offer={organization.offer}
          organizationId={organization.id}
          currency={organization.defaultCurrency}
          categories={categories.data.filter((c) => c.status === 'active')}
          taxRates={taxRates.data.filter((t) => t.status === 'active')}
        />
      </Card>
    </>
  );
}

export default function NewProductPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <NewProduct />
    </Suspense>
  );
}
