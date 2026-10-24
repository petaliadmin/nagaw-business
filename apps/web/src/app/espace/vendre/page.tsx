import {
  roleHasPermission,
  type CustomerDto,
  type ProductDto,
} from '@nagaw/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { apiAsUser } from '@/lib/api/server';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { Checkout } from './checkout';

export const metadata: Metadata = { title: 'Vendre — Nagaw Business' };

async function Sell() {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;
  const header = <PageHeader title="Vendre" />;
  if (!roleHasPermission(organization.role, 'sales.create')) {
    return (
      <>
        {header}
        <Alert>
          Votre rôle permet de consulter les ventes, pas d’en enregistrer.
        </Alert>
      </>
    );
  }

  const [products, customers] = await Promise.all([
    apiAsUser<ProductDto[]>(accessToken, {
      path: '/products',
      organizationId: organization.id,
    }),
    apiAsUser<CustomerDto[]>(accessToken, {
      path: '/customers',
      organizationId: organization.id,
    }),
  ]);
  if (!products.ok || !customers.ok) {
    const failed = !products.ok ? products : customers;
    return (
      <>
        {header}
        <Alert tone="error">
          Caisse indisponible : {!failed.ok && failed.message}
        </Alert>
      </>
    );
  }
  if (products.data.length === 0) {
    return (
      <>
        {header}
        <EmptyState title="Aucun produit à vendre">
          {roleHasPermission(organization.role, 'catalog.manage') ? (
            <Link
              href="/espace/produits/nouveau"
              className="inline-flex min-h-12 items-center font-bold text-brand-ink underline underline-offset-4"
            >
              Ajouter votre premier produit
            </Link>
          ) : (
            'Le propriétaire ou un gérant doit d’abord ajouter les produits.'
          )}
        </EmptyState>
      </>
    );
  }

  return (
    <>
      {header}
      <Checkout
        organizationId={organization.id}
        currency={organization.defaultCurrency}
        products={products.data}
        customers={customers.data}
      />
    </>
  );
}

export default function SellPage() {
  return (
    <Suspense fallback={<PageFallback label="Ouverture de la caisse…" />}>
      <Sell />
    </Suspense>
  );
}
