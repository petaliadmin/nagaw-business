import { formatAmount, type ProductDto } from '@nagaw/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ProductTile } from '@/components/catalog/product-tile';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { apiAsUser } from '@/lib/api/server';
import { requireReadyWorkspace } from '@/lib/workspace/load';

export const metadata: Metadata = {
  title: 'Produits et services archivés — Nagaw Business',
};

async function ArchivedProducts() {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;
  const products = await apiAsUser<ProductDto[]>(accessToken, {
    path: '/products?status=archived',
    organizationId: organization.id,
  });

  return (
    <>
      <PageHeader
        title="Produits et services archivés"
        description="Ils ne sont plus en vente mais leur historique est gardé. Ouvrez-en un pour le remettre en vente."
      />
      {!products.ok ? (
        <Alert tone="error">Produits indisponibles : {products.message}</Alert>
      ) : products.data.length === 0 ? (
        <EmptyState title="Rien d’archivé">
          <Link
            href="/espace/produits"
            className="inline-flex min-h-12 items-center font-bold text-brand-ink underline underline-offset-4"
          >
            Revenir aux produits et services
          </Link>
        </EmptyState>
      ) : (
        <ul aria-label="Produits archivés" className="flex flex-col gap-3">
          {products.data.map((product) => (
            <li key={product.id}>
              <Link
                href={`/espace/produits/${product.id}`}
                className="flex min-h-20 items-center gap-4 rounded-2xl border border-line bg-surface p-3"
              >
                <ProductTile product={product} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-lg font-bold">
                    {product.name}
                  </span>
                  <span className="text-ink-muted tabular-nums">
                    {formatAmount(
                      product.salePrice,
                      organization.defaultCurrency,
                    )}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function ArchivedProductsPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <ArchivedProducts />
    </Suspense>
  );
}
