import {
  formatAmount,
  roleHasPermission,
  sellsGoods,
  type CategoryDto,
  type ProductDto,
} from '@nagaw/shared';
import { FolderOpen, Plus, Scale, Search, Truck, X } from 'lucide-react';
import type { Metadata } from 'next';
import Form from 'next/form';
import Link from 'next/link';
import { Suspense } from 'react';
import { ProductFilters } from '@/components/catalog/product-filters';
import { ProductTile } from '@/components/catalog/product-tile';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button-link';
import { EmptyState } from '@/components/ui/empty-state';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { CONTROL } from '@/components/form-field';
import { apiAsUser } from '@/lib/api/server';
import { catalogBadge, formatQuantity } from '@/lib/catalog/labels';
import { CATALOG_NOUNS, CATALOG_TITLES } from '@/lib/catalog/offer';
import { pageNumber, pageParams, pageRows } from '@/lib/pagination';
import { requireReadyWorkspace } from '@/lib/workspace/load';

export const metadata: Metadata = {
  title: 'Produits et services — Nagaw Business',
};

const STOCK_FILTERS = [
  { value: '', label: 'Tous' },
  { value: 'low', label: 'Bientôt épuisés' },
  { value: 'out', label: 'Épuisés' },
] as const;

const KIND_FILTERS = [
  { value: '', label: 'Tout' },
  { value: 'product', label: 'Produits' },
  { value: 'service', label: 'Services' },
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
      className={`inline-flex min-h-12 items-center rounded-full border-2 px-4 text-base font-bold ${
        active
          ? 'border-stock-strong bg-stock-strong text-white'
          : 'border-line-strong bg-surface text-ink hover:bg-surface-muted'
      }`}
    >
      {children}
    </Link>
  );
}

/** A filter that is on, in view on the page: touching it removes it. */
function ActiveFilter({ href, label }: { href: string; label: string }) {
  return (
    <li>
      <Link
        href={href}
        className="inline-flex min-h-12 items-center gap-2 rounded-full bg-stock-strong px-4 text-base font-bold text-white"
      >
        <span className="sr-only">Retirer le filtre </span>
        {label}
        <X aria-hidden className="size-5 shrink-0" />
      </Link>
    </li>
  );
}

async function Products({ searchParams }: PageProps<'/espace/produits'>) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;
  const canManage = roleHasPermission(organization.role, 'catalog.manage');
  const { offer } = organization;

  const raw = await searchParams;
  const q = param(raw.q).trim();
  const categoryId = param(raw.categorie);
  const stock = param(raw.stock);
  const kind = param(raw.type);
  const page = pageNumber(raw.page);
  const current = new URLSearchParams();
  if (q) current.set('q', q);
  if (categoryId) current.set('categorie', categoryId);
  if (stock) current.set('stock', stock);
  if (kind) current.set('type', kind);

  const apiQuery = new URLSearchParams();
  if (q) apiQuery.set('q', q);
  if (categoryId) apiQuery.set('categoryId', categoryId);
  if (stock === 'low' || stock === 'out') apiQuery.set('stock', stock);
  if (kind === 'product' || kind === 'service') apiQuery.set('kind', kind);
  for (const [key, value] of Object.entries(pageParams(page)))
    apiQuery.set(key, value);

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
  const filtered = Boolean(q || categoryId || stock || kind);
  const list = products.ok ? pageRows(products.data) : null;
  const stockFilter = STOCK_FILTERS.find(
    (filter) => filter.value && filter.value === stock,
  );
  const kindFilter = KIND_FILTERS.find(
    (filter) => filter.value && filter.value === kind,
  );
  const category = activeCategories.find((c) => c.id === categoryId);

  return (
    <>
      <PageHeader
        title={CATALOG_TITLES[offer]}
        description={
          sellsGoods(offer)
            ? 'Ce que vous vendez, avec ce qui reste en stock.'
            : 'Ce que vous proposez à vos clients.'
        }
        actions={
          canManage ? (
            <ButtonLink href="/espace/produits/nouveau">
              <Plus aria-hidden className="size-5" />
              Ajouter un {CATALOG_NOUNS[offer]}
            </ButtonLink>
          ) : undefined
        }
      />

      <div className="flex gap-2">
        <Form
          action="/espace/produits"
          role="search"
          className="relative min-w-0 flex-1"
        >
          {categoryId && (
            <input type="hidden" name="categorie" value={categoryId} />
          )}
          {stock && <input type="hidden" name="stock" value={stock} />}
          {kind && <input type="hidden" name="type" value={kind} />}
          <label htmlFor="product-search" className="sr-only">
            Chercher un produit par nom ou code-barres
          </label>
          <input
            id="product-search"
            name="q"
            type="search"
            enterKeyHint="search"
            defaultValue={q}
            placeholder="Chercher…"
            className={`${CONTROL} pr-12`}
          />
          <button
            type="submit"
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-ink hover:bg-surface-muted"
          >
            <Search aria-hidden className="size-5" />
            <span className="sr-only">Chercher</span>
          </button>
        </Form>
        <ProductFilters
          activeCount={
            [stockFilter, kindFilter, category].filter(Boolean).length
          }
        >
          {offer === 'both' && (
            <nav aria-label="Filtrer par type" className="flex flex-col gap-2">
              <h3 className="font-bold">Type</h3>
              <ul className="flex flex-wrap gap-2">
                {KIND_FILTERS.map((filter) => (
                  <li key={filter.value}>
                    <Chip
                      href={filterHref(current, 'type', filter.value)}
                      active={kind === filter.value}
                    >
                      {filter.label}
                    </Chip>
                  </li>
                ))}
              </ul>
            </nav>
          )}
          {sellsGoods(offer) && (
            <nav aria-label="Filtrer par stock" className="flex flex-col gap-2">
              <h3 className="font-bold">Stock</h3>
              <ul className="flex flex-wrap gap-2">
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
          )}
          {activeCategories.length > 0 && (
            <nav
              aria-label="Filtrer par catégorie"
              className="flex flex-col gap-2"
            >
              <h3 className="font-bold">Catégorie</h3>
              <ul className="flex flex-wrap gap-2">
                <li>
                  <Chip
                    href={filterHref(current, 'categorie', '')}
                    active={!categoryId}
                  >
                    Toutes les catégories
                  </Chip>
                </li>
                {activeCategories.map((c) => (
                  <li key={c.id}>
                    <Chip
                      href={filterHref(current, 'categorie', c.id)}
                      active={categoryId === c.id}
                    >
                      {c.name}
                    </Chip>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </ProductFilters>
      </div>

      {(stockFilter || kindFilter || category) && (
        <ul aria-label="Filtres choisis" className="flex flex-wrap gap-2">
          {kindFilter && (
            <ActiveFilter
              href={filterHref(current, 'type', '')}
              label={kindFilter.label}
            />
          )}
          {stockFilter && (
            <ActiveFilter
              href={filterHref(current, 'stock', '')}
              label={stockFilter.label}
            />
          )}
          {category && (
            <ActiveFilter
              href={filterHref(current, 'categorie', '')}
              label={category.name}
            />
          )}
        </ul>
      )}

      {!products.ok ? (
        <Alert tone="error">Produits indisponibles : {products.message}</Alert>
      ) : !list || list.rows.length === 0 ? (
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
          <EmptyState title="Rien pour le moment">
            {canManage
              ? 'Ajoutez ce que vous vendez : son nom, son prix, et ce qu’il vous en reste pour un produit.'
              : 'Le propriétaire ou un gérant peut ajouter ce que la boutique vend.'}
          </EmptyState>
        )
      ) : (
        <ul
          aria-label="Produits"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
        >
          {list.rows.map((product) => (
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
                    <Badge tone={catalogBadge(product).tone}>
                      {catalogBadge(product).label}
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
      <Pagination
        path="/espace/produits"
        params={current}
        page={page}
        hasNext={list?.hasNext ?? false}
      />

      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/espace/produits/categories" variant="secondary">
          <FolderOpen aria-hidden className="size-5" />
          Catégories
        </ButtonLink>
        {sellsGoods(offer) && (
          <>
            <ButtonLink href="/espace/produits/unites" variant="secondary">
              <Scale aria-hidden className="size-5" />
              Unités
            </ButtonLink>
            <ButtonLink
              href="/espace/produits/fournisseurs"
              variant="secondary"
            >
              <Truck aria-hidden className="size-5" />
              Fournisseurs
            </ButtonLink>
          </>
        )}
        <ButtonLink href="/espace/produits/archives" variant="secondary">
          {CATALOG_TITLES[offer]} archivés
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
