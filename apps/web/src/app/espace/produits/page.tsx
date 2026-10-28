import {
  formatAmount,
  roleHasPermission,
  type CategoryDto,
  type ProductDto,
} from '@nagaw/shared';
import { FolderOpen, Plus, Scale, Search, Truck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ProductTile } from '@/components/catalog/product-tile';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button-link';
import { buttonClasses } from '@/components/ui/button-styles';
import { EmptyState } from '@/components/ui/empty-state';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { CONTROL } from '@/components/form-field';
import { apiAsUser } from '@/lib/api/server';
import {
  formatQuantity,
  STOCK_LEVEL_LABELS,
  STOCK_LEVEL_TONES,
} from '@/lib/catalog/labels';
import { requireReadyWorkspace } from '@/lib/workspace/load';

export const metadata: Metadata = { title: 'Produits — Nagaw Business' };

const STOCK_FILTERS = [
  { value: '', label: 'Tous' },
  { value: 'low', label: 'Bientôt épuisés' },
  { value: 'out', label: 'Épuisés' },
] as const;

function param(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : '';
}

function filterHref(current: URLSearchParams, key: string, value: string) {
  const next = new URLSearchParams(current);
  if (value) next.set(key, value);
  else next.delete(key);
  const query = next.toString();
  return query ? `/espace/produits?${query}` : '/espace/produits';
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={`inline-flex min-h-12 shrink-0 items-center rounded-full border-2 px-4 text-base font-bold whitespace-nowrap ${
        active
          ? 'border-stock-strong bg-stock-strong text-white'
          : 'border-line-strong bg-surface text-ink hover:bg-surface-muted'
      }`}
    >
      {children}
    </Link>
  );
}

async function Products({ searchParams }: PageProps<'/espace/produits'>) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;
  const canManage = roleHasPermission(organization.role, 'catalog.manage');

  const raw = await searchParams;
  const q = param(raw.q).trim();
  const categoryId = param(raw.categorie);
  const stock = param(raw.stock);
  const current = new URLSearchParams();
  if (q) current.set('q', q);
  if (categoryId) current.set('categorie', categoryId);
  if (stock) current.set('stock', stock);

  const apiQuery = new URLSearchParams();
  if (q) apiQuery.set('q', q);
  if (categoryId) apiQuery.set('categoryId', categoryId);
  if (stock === 'low' || stock === 'out') apiQuery.set('stock', stock);

  const [products, categories] = await Promise.all([
    apiAsUser<ProductDto[]>(accessToken, {
      path: `/products?${apiQuery}`,
      organizationId: organization.id,
    }),
    apiAsUser<CategoryDto[]>(accessToken, {
      path: '/product-categories',
      organizationId: organization.id,
    }),
  ]);
  const activeCategories = categories.ok
    ? categories.data.filter((c) => c.status === 'active')
    : [];
  const filtered = Boolean(q || categoryId || stock);

  return (
    <>
      <PageHeader
        title="Produits"
        description="Ce que vous vendez, avec ce qui reste en stock."
        actions={
          canManage ? (
            <ButtonLink href="/espace/produits/nouveau">
              <Plus aria-hidden className="size-5" />
              Ajouter un produit
            </ButtonLink>
          ) : undefined
        }
      />

      <form action="/espace/produits" role="search" className="flex gap-2">
        {categoryId && (
          <input type="hidden" name="categorie" value={categoryId} />
        )}
        {stock && <input type="hidden" name="stock" value={stock} />}
        <label htmlFor="product-search" className="sr-only">
          Chercher un produit par nom ou code-barres
        </label>
        <input
          id="product-search"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Nom ou code-barres"
          className={`${CONTROL} min-w-0 flex-1`}
        />
        <button type="submit" className={buttonClasses('secondary')}>
          <Search aria-hidden className="size-5" />
          Chercher
        </button>
      </form>

      <nav
        aria-label="Filtrer par stock"
        className="-mx-4 overflow-x-auto px-4"
      >
        <ul className="flex gap-2">
          {STOCK_FILTERS.map((filter) => (
            <li key={filter.value}>
              <Chip
                href={filterHref(current, 'stock', filter.value)}
                active={stock === filter.value}
              >
                {filter.label}
              </Chip>
            </li>
          ))}
        </ul>
      </nav>
      {activeCategories.length > 0 && (
        <nav
          aria-label="Filtrer par catégorie"
          className="-mx-4 overflow-x-auto px-4"
        >
          <ul className="flex gap-2">
            <li>
              <Chip
                href={filterHref(current, 'categorie', '')}
                active={!categoryId}
              >
                Toutes les catégories
              </Chip>
            </li>
            {activeCategories.map((category) => (
              <li key={category.id}>
                <Chip
                  href={filterHref(current, 'categorie', category.id)}
                  active={categoryId === category.id}
                >
                  {category.name}
                </Chip>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {!products.ok ? (
        <Alert tone="error">Produits indisponibles : {products.message}</Alert>
      ) : products.data.length === 0 ? (
        filtered ? (
          <EmptyState title="Aucun produit ne correspond">
            <Link
              href="/espace/produits"
              className="inline-flex min-h-12 items-center font-bold text-brand-ink underline underline-offset-4"
            >
              Voir tous les produits
            </Link>
          </EmptyState>
        ) : (
          <EmptyState title="Aucun produit pour le moment">
            {canManage
              ? 'Ajoutez votre premier produit : son nom, son prix et ce qu’il vous en reste.'
              : 'Le propriétaire ou un gérant peut ajouter les produits de la boutique.'}
          </EmptyState>
        )
      ) : (
        <ul
          aria-label="Produits"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
        >
          {products.data.map((product) => (
            <li key={product.id}>
              <Link
                href={`/espace/produits/${product.id}`}
                className="flex min-h-24 items-center gap-4 rounded-2xl border border-line bg-surface p-3 shadow-sm hover:border-stock"
              >
                <ProductTile product={product} />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-lg font-bold">
                    {product.name}
                  </span>
                  <span className="text-xl font-extrabold tabular-nums text-stock-ink">
                    {formatAmount(
                      product.salePrice,
                      organization.defaultCurrency,
                    )}
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge tone={STOCK_LEVEL_TONES[product.stockLevel]}>
                      {STOCK_LEVEL_LABELS[product.stockLevel]}
                    </Badge>
                    {product.trackStock && (
                      <span className="text-base text-ink-muted tabular-nums">
                        {formatQuantity(product.stockQuantity, product.unit)}
                      </span>
                    )}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/espace/produits/categories" variant="secondary">
          <FolderOpen aria-hidden className="size-5" />
          Catégories
        </ButtonLink>
        <ButtonLink href="/espace/produits/unites" variant="secondary">
          <Scale aria-hidden className="size-5" />
          Unités
        </ButtonLink>
        <ButtonLink href="/espace/produits/fournisseurs" variant="secondary">
          <Truck aria-hidden className="size-5" />
          Fournisseurs
        </ButtonLink>
        <ButtonLink href="/espace/produits/archives" variant="secondary">
          Produits archivés
        </ButtonLink>
      </div>
    </>
  );
}

export default function ProductsPage(props: PageProps<'/espace/produits'>) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Products {...props} />
    </Suspense>
  );
}
