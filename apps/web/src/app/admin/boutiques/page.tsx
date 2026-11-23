import type { AdminShopListItemDto } from '@nagaw/shared';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { CONTROL } from '@/components/form-field';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { buttonClasses } from '@/components/ui/button-styles';
import { EmptyState } from '@/components/ui/empty-state';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { requirePlatformAdmin } from '@/lib/admin/load';
import { apiAsUser } from '@/lib/api/server';
import { formatContact, formatDate, formatDateTime } from '@/lib/format';
import { pageNumber, pageParams, pageRows } from '@/lib/pagination';

async function Shops({ searchParams }: PageProps<'/admin/boutiques'>) {
  const admin = await requirePlatformAdmin();
  if (!admin) return null;
  const raw = await searchParams;
  const q = typeof raw.q === 'string' ? raw.q.trim() : '';
  // « Toutes » (archived apart), « Suspendues », « Archivées » (ADR-074).
  const view =
    raw.vue === 'suspendues'
      ? 'suspended'
      : raw.vue === 'archivees'
        ? 'archived'
        : null;
  const page = pageNumber(raw.page);
  const filters = new URLSearchParams({
    ...(q ? { q } : {}),
    ...(typeof raw.vue === 'string' && view ? { vue: raw.vue } : {}),
  });
  const result = await apiAsUser<AdminShopListItemDto[]>(admin.accessToken, {
    path: `/admin/shops?${new URLSearchParams({
      ...(q ? { q } : {}),
      ...(view ? { status: view } : {}),
      ...pageParams(page),
    })}`,
  });
  const tabs = [
    { vue: '', label: 'En service', on: view === null },
    { vue: 'suspendues', label: 'Suspendues', on: view === 'suspended' },
    { vue: 'archivees', label: 'Archivées', on: view === 'archived' },
  ];
  const list = result.ok ? pageRows(result.data) : null;
  return (
    <>
      <PageHeader title="Boutiques" />
      <form
        action="/admin/boutiques"
        role="search"
        className="flex flex-col gap-2 sm:flex-row"
      >
        {view && <input type="hidden" name="vue" value={String(raw.vue)} />}
        <label htmlFor="shop-search" className="sr-only">
          Chercher une boutique par nom ou e-mail
        </label>
        <input
          id="shop-search"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Nom ou e-mail"
          className={`${CONTROL} flex-1`}
        />
        <button type="submit" className={buttonClasses('secondary')}>
          <Search aria-hidden className="size-5" />
          Chercher
        </button>
      </form>
      <nav aria-label="Boutiques" className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.label}
            href={`/admin/boutiques?${new URLSearchParams({
              ...(tab.vue ? { vue: tab.vue } : {}),
              ...(q ? { q } : {}),
            })}`}
            aria-current={tab.on ? 'page' : undefined}
            className={`min-h-12 rounded-full border-2 px-4 py-2.5 font-bold ${tab.on ? 'border-ink bg-canvas' : 'border-transparent bg-surface'}`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {!result.ok ? (
        <Alert tone="error">Boutiques indisponibles : {result.message}</Alert>
      ) : !list || list.rows.length === 0 ? (
        <EmptyState title="Aucune boutique trouvée" />
      ) : (
        <ul aria-label="Liste des boutiques" className="flex flex-col gap-2">
          {list.rows.map((shop) => (
            <li key={shop.id}>
              <Link
                href={`/admin/boutiques/${shop.id}`}
                className="flex min-h-16 flex-wrap items-center justify-between gap-3 rounded-3xl bg-surface px-4 py-3"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="font-bold">{shop.name}</span>
                  <span className="truncate text-ink-muted">
                    {shop.ownerEmails.map(formatContact).join(', ') ||
                      'sans propriétaire actif'}{' '}
                    · {shop.members} personne(s)
                  </span>
                  <span className="text-ink-muted">
                    {shop.lastSaleAt
                      ? `Dernière vente : ${formatDateTime(shop.lastSaleAt, 'UTC')} (UTC)`
                      : 'Aucune vente'}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <Badge tone="brand">{shop.plan.name}</Badge>
                  {shop.lifetime ? (
                    <Badge tone="success">À vie</Badge>
                  ) : (
                    shop.currentPeriodEnd && (
                      <span className="text-sm text-ink-muted">
                        jusqu’au {formatDate(shop.currentPeriodEnd, 'UTC')}
                      </span>
                    )
                  )}
                  {shop.pendingInvoices > 0 && (
                    <Badge tone={shop.overdueInvoice ? 'danger' : 'warning'}>
                      {shop.overdueInvoice
                        ? 'Facture en retard'
                        : 'Facture à payer'}
                    </Badge>
                  )}
                  {shop.status === 'suspended' && (
                    <Badge tone="danger">Suspendue</Badge>
                  )}
                  {shop.status === 'archived' && <Badge>Archivée</Badge>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pagination
        path="/admin/boutiques"
        params={filters}
        page={page}
        hasNext={list?.hasNext ?? false}
      />
    </>
  );
}

export default function ShopsPage(props: PageProps<'/admin/boutiques'>) {
  return (
    <Suspense fallback={<PageFallback variant="list" />}>
      <Shops {...props} />
    </Suspense>
  );
}
