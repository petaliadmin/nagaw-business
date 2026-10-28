import {
  formatAmount,
  formatRate,
  roleHasPermission,
  type ProductDto,
  type StockMovementDto,
  type SupplierDto,
  type UnitTemplateDto,
  UNITS,
} from '@nagaw/shared';
import { History, Info, Pencil } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ProductTile } from '@/components/catalog/product-tile';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button-link';
import { Card, Stat } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageFallback } from '@/components/ui/page-fallback';
import { apiAsUser } from '@/lib/api/server';
import {
  CATEGORY_TONES,
  formatQuantity,
  formatQuantityChange,
  MOVEMENT_LABELS,
  STOCK_LEVEL_LABELS,
  STOCK_LEVEL_TONES,
} from '@/lib/catalog/labels';
import { formatDateTime } from '@/lib/format';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { ProductStatusForm } from './status-form';
import { StockForms } from './stock-forms';
import { UnitsSection } from './units-section';

export const metadata: Metadata = { title: 'Produit — Nagaw Business' };

function MovementLine({
  movement,
  product,
  currency,
  timeZone,
}: {
  movement: StockMovementDto;
  product: ProductDto;
  currency: string;
  timeZone: string;
}) {
  const details = [
    movement.kind === 'inventory' && movement.countedQuantity !== null
      ? `compté : ${formatQuantity(movement.countedQuantity, product.unit)}`
      : null,
    movement.unitCost !== null
      ? `${formatAmount(movement.unitCost, currency)} l’unité`
      : null,
    movement.supplier ? movement.supplier.name : null,
    movement.reason,
  ].filter(Boolean);
  const tone =
    movement.quantity > 0
      ? 'text-sales-ink'
      : movement.quantity < 0
        ? 'text-danger-ink'
        : 'text-ink-muted';
  return (
    <li className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3 first:pt-0">
      <div className="flex min-w-0 flex-col">
        <span className="font-semibold">{MOVEMENT_LABELS[movement.kind]}</span>
        {details.length > 0 && (
          <span className="text-ink-muted">{details.join(' · ')}</span>
        )}
        <span className="text-ink-muted">
          {formatDateTime(movement.occurredAt, timeZone)} —{' '}
          {movement.createdBy.email}
        </span>
      </div>
      <span className={`text-lg font-extrabold tabular-nums ${tone}`}>
        {formatQuantityChange(movement.quantity, product.unit)}
      </span>
    </li>
  );
}

async function Product({
  params,
  searchParams,
}: PageProps<'/espace/produits/[id]'>) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;
  const { id } = await params;
  const photoFailed = (await searchParams).photo === 'echec';
  const currency = organization.defaultCurrency;
  const canManage = roleHasPermission(organization.role, 'catalog.manage');
  const canMove = roleHasPermission(organization.role, 'stock.move');
  // Sellers record deliveries only (ADR-036).
  const canReceive = roleHasPermission(organization.role, 'stock.receive');

  const [product, movements, suppliers, templates] = await Promise.all([
    apiAsUser<ProductDto>(accessToken, {
      path: `/products/${encodeURIComponent(id)}`,
      organizationId: organization.id,
    }),
    apiAsUser<StockMovementDto[]>(accessToken, {
      path: `/products/${encodeURIComponent(id)}/movements`,
      organizationId: organization.id,
    }),
    canReceive
      ? apiAsUser<SupplierDto[]>(accessToken, {
          path: '/suppliers',
          organizationId: organization.id,
        })
      : null,
    canManage
      ? apiAsUser<UnitTemplateDto[]>(accessToken, {
          path: '/unit-templates',
          organizationId: organization.id,
        })
      : null,
  ]);
  if (!product.ok && product.status === 404) notFound();
  if (!product.ok)
    return <Alert tone="error">Produit indisponible : {product.message}</Alert>;

  const p = product.data;
  const margin =
    p.purchasePrice !== null ? p.salePrice - p.purchasePrice : null;

  return (
    <>
      {photoFailed && (
        <Alert tone="warning">
          Le produit est enregistré, mais la photo n’a pas pu l’être. Réessayez
          depuis « Modifier ».
        </Alert>
      )}
      {p.status === 'archived' && (
        <Alert tone="warning">
          Ce produit est archivé : il n’est plus proposé à la vente.
        </Alert>
      )}

      <header className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <ProductTile product={p} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">
            {p.name}
          </h1>
          <p className="text-3xl font-extrabold tabular-nums text-stock-ink">
            {formatAmount(p.salePrice, currency)}
            <span className="text-lg font-semibold text-ink-muted">
              {' '}
              / {UNITS[p.unit].label}
            </span>
          </p>
          {p.category && (
            <span
              className={`inline-flex self-start rounded-full px-3 py-0.5 text-base font-semibold ${CATEGORY_TONES[p.category.color]}`}
            >
              {p.category.name}
            </span>
          )}
        </div>
        {canManage && (
          <ButtonLink
            href={`/espace/produits/${p.id}/modifier`}
            variant="secondary"
          >
            <Pencil aria-hidden className="size-5" />
            Modifier
          </ButtonLink>
        )}
      </header>

      <section
        aria-labelledby="stock-title"
        className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm md:p-6"
      >
        <h2 id="stock-title" className="text-xl font-bold">
          Ce qui reste
        </h2>
        {p.trackStock ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-4xl font-extrabold tabular-nums">
              {formatQuantity(p.stockQuantity, p.unit)}
            </p>
            <Badge tone={STOCK_LEVEL_TONES[p.stockLevel]}>
              {STOCK_LEVEL_LABELS[p.stockLevel]}
            </Badge>
          </div>
        ) : (
          <p className="text-ink-muted">
            Le stock de ce produit n’est pas suivi.
          </p>
        )}
        {p.trackStock && p.lowStockThreshold !== null && (
          <p className="text-ink-muted">
            Alerte quand il en reste{' '}
            {formatQuantity(p.lowStockThreshold, p.unit)} ou moins.
          </p>
        )}
      </section>

      <UnitsSection
        organizationId={organization.id}
        product={p}
        currency={currency}
        templates={templates?.ok ? templates.data : []}
        canManage={canManage}
      />

      {canReceive && p.trackStock && p.status === 'active' && (
        <StockForms
          receiveOnly={!canMove}
          organizationId={organization.id}
          currency={currency}
          product={p}
          suppliers={
            suppliers?.ok
              ? suppliers.data.filter((s) => s.status === 'active')
              : []
          }
        />
      )}

      {p.trackStock && (
        <Card title="Mouvements du stock" titleId="movements" icon={History}>
          {!movements.ok ? (
            <Alert tone="error">
              Mouvements indisponibles : {movements.message}
            </Alert>
          ) : movements.data.length === 0 ? (
            <EmptyState title="Aucun mouvement pour le moment">
              Les entrées, pertes et inventaires apparaîtront ici.
            </EmptyState>
          ) : (
            <ul
              aria-label="Mouvements du stock"
              className="flex flex-col divide-y divide-line"
            >
              {movements.data.map((movement) => (
                <MovementLine
                  key={movement.id}
                  movement={movement}
                  product={p}
                  currency={currency}
                  timeZone={organization.timezone}
                />
              ))}
            </ul>
          )}
        </Card>
      )}

      <Card title="Détails" titleId="details" icon={Info}>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Stat
            label="Prix d’achat"
            value={
              p.purchasePrice !== null
                ? formatAmount(p.purchasePrice, currency)
                : 'Non renseigné'
            }
          />
          <Stat
            label="Ce que vous gagnez par unité"
            value={
              margin !== null
                ? formatAmount(margin, currency)
                : 'Ajoutez le prix d’achat'
            }
          />
          <Stat
            label="Taxe comprise"
            value={
              p.taxRate
                ? `${p.taxRate.name} — ${formatRate(p.taxRate.rateBasisPoints)}`
                : 'Aucune'
            }
          />
          <Stat label="Code-barres" value={p.barcode ?? 'Aucun'} />
        </dl>
      </Card>

      {canManage && (
        <ProductStatusForm organizationId={organization.id} product={p} />
      )}
    </>
  );
}

export default function ProductPage(props: PageProps<'/espace/produits/[id]'>) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Product {...props} />
    </Suspense>
  );
}
