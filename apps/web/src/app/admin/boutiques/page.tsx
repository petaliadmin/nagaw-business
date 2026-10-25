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
import { requirePlatformAdmin } from '@/lib/admin/load';
import { apiAsUser } from '@/lib/api/server';
import { formatDateTime } from '@/lib/format';

async function Shops({ searchParams }: PageProps<'/admin/boutiques'>) {
  const admin = await requirePlatformAdmin();
  if (!admin) return null;
  const raw = await searchParams;
  const q = typeof raw.q === 'string' ? raw.q.trim() : '';
  const result = await apiAsUser<AdminShopListItemDto[]>(admin.accessToken, {
    path: `/admin/shops${q ? `?${new URLSearchParams({ q })}` : ''}`,
  });
  return (
    <>
      <PageHeader title="Boutiques" />
      <form
        action="/admin/boutiques"
        role="search"
        className="flex flex-col gap-2 sm:flex-row"
      >
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
      {!result.ok ? (
        <Alert tone="error">Boutiques indisponibles : {result.message}</Alert>
      ) : result.data.length === 0 ? (
        <EmptyState title="Aucune boutique trouvée" />
      ) : (
        <ul aria-label="Liste des boutiques" className="flex flex-col gap-2">
          {result.data.map((shop) => (
            <li key={shop.id}>
              <Link
                href={`/admin/boutiques/${shop.id}`}
                className="flex min-h-16 flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="font-bold">{shop.name}</span>
                  <span className="truncate text-ink-muted">
                    {shop.ownerEmails.join(', ') || 'sans propriétaire actif'} ·{' '}
                    {shop.members} personne(s)
                  </span>
                  <span className="text-ink-muted">
                    {shop.lastSaleAt
                      ? `Dernière vente : ${formatDateTime(shop.lastSaleAt, 'UTC')} (UTC)`
                      : 'Aucune vente'}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <Badge tone="brand">{shop.plan.name}</Badge>
                  {shop.status === 'suspended' && (
                    <Badge tone="danger">Suspendue</Badge>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function ShopsPage(props: PageProps<'/admin/boutiques'>) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Shops {...props} />
    </Suspense>
  );
}
