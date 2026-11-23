import type {
  AdminDataItemDto,
  AdminDataKind,
  AdminShopDto,
} from '@nagaw/shared';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { CONTROL } from '@/components/form-field';
import { Alert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button-styles';
import { EmptyState } from '@/components/ui/empty-state';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { requirePlatformAdmin } from '@/lib/admin/load';
import { apiAsUser } from '@/lib/api/server';
import { formatDateTime } from '@/lib/format';
import { ShopDataAction } from '../../../forms';

const KINDS: {
  kind: AdminDataKind;
  slug: string;
  label: string;
  closed: string;
}[] = [
  { kind: 'products', slug: 'produits', label: 'Produits', closed: 'Archivés' },
  { kind: 'customers', slug: 'clients', label: 'Clients', closed: 'Archivés' },
  {
    kind: 'suppliers',
    slug: 'fournisseurs',
    label: 'Fournisseurs',
    closed: 'Archivés',
  },
  {
    kind: 'categories',
    slug: 'categories',
    label: 'Catégories',
    closed: 'Archivées',
  },
  { kind: 'sales', slug: 'ventes', label: 'Ventes', closed: 'Annulées' },
  { kind: 'invoices', slug: 'factures', label: 'Factures', closed: 'Annulées' },
];

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * The data of a shop, for the administration once entered with a reason
 * (ADR-040, ADR-074): archive, restore, cancel.
 */
async function ShopData({ params, searchParams }: Props) {
  const admin = await requirePlatformAdmin();
  if (!admin) return null;
  const { id } = await params;
  const raw = await searchParams;
  const current = KINDS.find((k) => k.slug === raw.type) ?? KINDS[0]!;
  const closed = raw.vue === 'fermes';
  const q = typeof raw.q === 'string' ? raw.q.trim() : '';
  const shop = await apiAsUser<AdminShopDto>(admin.accessToken, {
    path: `/admin/shops/${encodeURIComponent(id)}`,
  });
  if (!shop.ok && shop.status === 404) notFound();
  if (!shop.ok)
    return <Alert tone="error">Boutique indisponible : {shop.message}</Alert>;
  const s = shop.data;
  const header = (
    <PageHeader
      title={`Données de ${s.name}`}
      description="Archiver garde tout et le range ; une vente ou une facture annulée reste dans l’historique. Chaque action est inscrite au nom de la plateforme, avec son motif."
    />
  );
  if (!s.access)
    return (
      <>
        {header}
        <Alert>
          Entrez d’abord dans la boutique, avec un motif, depuis{' '}
          <Link
            href={`/admin/boutiques/${s.id}`}
            className="font-bold underline"
          >
            sa fiche
          </Link>
          : ses données ne s’ouvrent qu’ainsi.
        </Alert>
      </>
    );
  const items = await apiAsUser<AdminDataItemDto[]>(admin.accessToken, {
    path: `/admin/shops/${encodeURIComponent(id)}/data/${current.kind}?${new URLSearchParams(
      {
        ...(q ? { q } : {}),
        closed: String(closed),
      },
    )}`,
  });
  const href = (change: Record<string, string>) => {
    const next = {
      type: current.slug,
      ...(closed ? { vue: 'fermes' } : {}),
      ...change,
    };
    return `/admin/boutiques/${s.id}/donnees?${new URLSearchParams(
      Object.fromEntries(Object.entries(next).filter(([, v]) => v !== '')),
    )}`;
  };
  const pill = (on: boolean) =>
    `min-h-12 rounded-full border-2 px-4 py-2.5 font-bold ${on ? 'border-ink bg-canvas' : 'border-transparent bg-surface'}`;
  return (
    <>
      <Link
        href={`/admin/boutiques/${s.id}`}
        className="inline-flex min-h-12 items-center font-semibold text-brand-ink underline underline-offset-4"
      >
        Retour à la fiche de {s.name}
      </Link>
      {header}
      <nav aria-label="Type de données" className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <Link
            key={k.kind}
            href={href({ type: k.slug, vue: '' })}
            aria-current={k.kind === current.kind ? 'page' : undefined}
            className={pill(k.kind === current.kind)}
          >
            {k.label}
          </Link>
        ))}
      </nav>
      <div className="flex flex-wrap gap-2" role="group" aria-label="État">
        <Link
          href={href({ vue: '' })}
          aria-current={closed ? undefined : 'true'}
          className={pill(!closed)}
        >
          En service
        </Link>
        <Link
          href={href({ vue: 'fermes' })}
          aria-current={closed ? 'true' : undefined}
          className={pill(closed)}
        >
          {current.closed}
        </Link>
      </div>
      <form
        action={`/admin/boutiques/${s.id}/donnees`}
        role="search"
        className="flex flex-col gap-2 sm:flex-row"
      >
        <input type="hidden" name="type" value={current.slug} />
        {closed && <input type="hidden" name="vue" value="fermes" />}
        <label htmlFor="data-search" className="sr-only">
          Chercher dans {current.label.toLowerCase()}
        </label>
        <input
          id="data-search"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Nom, numéro…"
          className={`${CONTROL} flex-1`}
        />
        <button type="submit" className={buttonClasses('secondary')}>
          <Search aria-hidden className="size-5" />
          Chercher
        </button>
      </form>
      {!items.ok ? (
        <Alert tone="error">Données indisponibles : {items.message}</Alert>
      ) : items.data.length === 0 ? (
        <EmptyState title="Rien ici" />
      ) : (
        <ul
          aria-label={`${current.label} de la boutique`}
          className="flex flex-col gap-3"
        >
          {items.data.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-3 rounded-3xl bg-surface p-4"
            >
              <span className="flex flex-col">
                <span className="font-bold">{item.label}</span>
                <span className="text-ink-muted">
                  {item.detail} · {formatDateTime(item.createdAt, 'UTC')} (UTC)
                </span>
              </span>
              {item.action && (
                <ShopDataAction
                  shopId={s.id}
                  kind={current.kind}
                  itemId={item.id}
                  action={item.action}
                  label={item.label}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function ShopDataPage(props: Props) {
  return (
    <Suspense fallback={<PageFallback variant="list" />}>
      <ShopData {...props} />
    </Suspense>
  );
}
