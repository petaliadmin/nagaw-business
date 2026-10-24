import {
  roleHasPermission,
  type CategoryDto,
  type ProductDto,
  type TaxRateDto,
} from '@nagaw/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { apiAsUser } from '@/lib/api/server';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { ProductForm } from '../../product-form';

export const metadata: Metadata = {
  title: 'Modifier un produit — Nagaw Business',
};

async function EditProduct({
  params,
}: PageProps<'/espace/produits/[id]/modifier'>) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;
  const { id } = await params;
  if (!roleHasPermission(organization.role, 'catalog.manage')) {
    return (
      <>
        <PageHeader title="Modifier un produit" />
        <Alert>
          Seuls le propriétaire et les gérants modifient les produits.
        </Alert>
      </>
    );
  }

  const [product, categories, taxRates] = await Promise.all([
    apiAsUser<ProductDto>(accessToken, {
      path: `/products/${encodeURIComponent(id)}`,
      organizationId: organization.id,
    }),
    apiAsUser<CategoryDto[]>(accessToken, {
      path: '/product-categories',
      organizationId: organization.id,
    }),
    apiAsUser<TaxRateDto[]>(accessToken, {
      path: '/tax-rates',
      organizationId: organization.id,
    }),
  ]);
  if (!product.ok && product.status === 404) notFound();
  const failed = [product, categories, taxRates].find((r) => !r.ok);
  if (failed && !failed.ok)
    return (
      <Alert tone="error">Formulaire indisponible : {failed.message}</Alert>
    );
  if (!product.ok || !categories.ok || !taxRates.ok) return null;

  return (
    <>
      <PageHeader title={`Modifier « ${product.data.name} »`} />
      <Card>
        <ProductForm
          organizationId={organization.id}
          currency={organization.defaultCurrency}
          categories={categories.data.filter((c) => c.status === 'active')}
          taxRates={taxRates.data.filter((t) => t.status === 'active')}
          product={product.data}
        />
      </Card>
    </>
  );
}

export default function EditProductPage(
  props: PageProps<'/espace/produits/[id]/modifier'>,
) {
  return (
    <Suspense fallback={<PageFallback />}>
      <EditProduct {...props} />
    </Suspense>
  );
}
