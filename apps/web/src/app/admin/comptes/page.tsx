import type { AdminUserDto } from '@nagaw/shared';
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
import { formatContact, formatDateTime } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/labels';
import { pageNumber, pageParams, pageRows } from '@/lib/pagination';
import { ArchiveForm } from '../forms';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** The accounts of the platform: find one, archive or reopen it (ADR-074). */
async function Accounts({ searchParams }: Props) {
  const admin = await requirePlatformAdmin();
  if (!admin) return null;
  const raw = await searchParams;
  const q = typeof raw.q === 'string' ? raw.q.trim() : '';
  const archived = raw.vue === 'archives';
  const page = pageNumber(raw.page);
  const filters = new URLSearchParams({
    ...(q ? { q } : {}),
    ...(archived ? { vue: 'archives' } : {}),
  });
  const result = await apiAsUser<AdminUserDto[]>(admin.accessToken, {
    path: `/admin/users?${new URLSearchParams({
      ...(q ? { q } : {}),
      archived: String(archived),
      ...pageParams(page),
    })}`,
  });
  const list = result.ok ? pageRows(result.data) : null;
  return (
    <>
      <PageHeader
        title="Comptes"
        description="Les personnes inscrites et leurs boutiques. Un compte archivé ne se connecte plus ; rien n’est effacé."
      />
      <form
        action="/admin/comptes"
        role="search"
        className="flex flex-col gap-2 sm:flex-row"
      >
        {archived && <input type="hidden" name="vue" value="archives" />}
        <label htmlFor="user-search" className="sr-only">
          Chercher un compte par numéro, e-mail ou nom
        </label>
        <input
          id="user-search"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Numéro, e-mail ou nom"
          className={`${CONTROL} flex-1`}
        />
        <button type="submit" className={buttonClasses('secondary')}>
          <Search aria-hidden className="size-5" />
          Chercher
        </button>
      </form>
      <nav aria-label="Comptes" className="flex gap-2">
        <Link
          href={`/admin/comptes${q ? `?q=${encodeURIComponent(q)}` : ''}`}
          aria-current={archived ? undefined : 'page'}
          className={`min-h-12 rounded-full border-2 px-4 py-2.5 font-bold ${archived ? 'border-transparent bg-surface' : 'border-ink bg-canvas'}`}
        >
          Ouverts
        </Link>
        <Link
          href={`/admin/comptes?vue=archives${q ? `&q=${encodeURIComponent(q)}` : ''}`}
          aria-current={archived ? 'page' : undefined}
          className={`min-h-12 rounded-full border-2 px-4 py-2.5 font-bold ${archived ? 'border-ink bg-canvas' : 'border-transparent bg-surface'}`}
        >
          Archivés
        </Link>
      </nav>
      {!result.ok ? (
        <Alert tone="error">Comptes indisponibles : {result.message}</Alert>
      ) : !list || list.rows.length === 0 ? (
        <EmptyState
          title={archived ? 'Aucun compte archivé' : 'Aucun compte trouvé'}
        />
      ) : (
        <ul aria-label="Liste des comptes" className="flex flex-col gap-3">
          {list.rows.map((u) => {
            const who = formatContact(u.contact);
            return (
              <li
                key={u.id}
                className="flex flex-col gap-3 rounded-3xl bg-surface p-4"
              >
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex min-w-0 flex-col">
                    <span className="font-bold break-all">{who}</span>
                    {u.displayName && (
                      <span className="text-ink-muted">{u.displayName}</span>
                    )}
                  </span>
                  {u.platformAdmin && (
                    <Badge tone="brand">Administration</Badge>
                  )}
                </span>
                <span className="text-ink-muted">
                  Inscrit le {formatDateTime(u.createdAt, 'UTC')} (UTC)
                </span>
                {u.shops.length > 0 ? (
                  <ul className="flex flex-wrap gap-2">
                    {u.shops.map((shop) => (
                      <li key={shop.id}>
                        <Link
                          href={`/admin/boutiques/${shop.id}`}
                          className="inline-flex min-h-12 items-center gap-2 rounded-full bg-surface-muted px-3 font-semibold"
                        >
                          {shop.name} · {ROLE_LABELS[shop.role]}
                          {!shop.active && ' (désactivé)'}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-ink-muted">Aucune boutique.</p>
                )}
                {u.archived && (
                  <p className="font-semibold text-warning-ink">
                    Archivé le {formatDateTime(u.archived.at, 'UTC')} (UTC) :{' '}
                    {u.archived.reason}
                  </p>
                )}
                {!u.platformAdmin && (
                  <ArchiveForm
                    target="user"
                    targetId={u.id}
                    name={who}
                    archived={u.archived !== null}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Pagination
        path="/admin/comptes"
        params={filters}
        page={page}
        hasNext={list?.hasNext ?? false}
      />
    </>
  );
}

export default function AccountsPage(props: Props) {
  return (
    <Suspense fallback={<PageFallback variant="list" />}>
      <Accounts {...props} />
    </Suspense>
  );
}
