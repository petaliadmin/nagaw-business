import type { AdminPlanRequestDto } from '@nagaw/shared';
import Link from 'next/link';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { buttonClasses } from '@/components/ui/button-styles';
import { EmptyState } from '@/components/ui/empty-state';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { requirePlatformAdmin } from '@/lib/admin/load';
import { apiAsUser } from '@/lib/api/server';
import { formatDateTime } from '@/lib/format';
import { ResolveRequestForm } from '../forms';

const STATUS = {
  pending: 'En attente',
  cancelled: 'Annulée par la boutique',
  done: 'Acceptée',
  rejected: 'Refusée',
} as const;

async function Requests({ searchParams }: PageProps<'/admin/demandes'>) {
  const admin = await requirePlatformAdmin();
  if (!admin) return null;
  const all = (await searchParams).toutes === '1';
  const result = await apiAsUser<AdminPlanRequestDto[]>(admin.accessToken, {
    path: `/admin/plan-requests${all ? '?status=all' : ''}`,
  });
  return (
    <>
      <PageHeader
        title="Demandes d’offre"
        description="Sans paiement en ligne, une demande est acceptée une fois le règlement reçu."
      />
      <nav aria-label="Demandes affichées" className="flex flex-wrap gap-2">
        <Link
          href="/admin/demandes"
          aria-current={!all ? 'true' : undefined}
          className={buttonClasses(!all ? 'primary' : 'secondary')}
        >
          En attente
        </Link>
        <Link
          href="/admin/demandes?toutes=1"
          aria-current={all ? 'true' : undefined}
          className={buttonClasses(all ? 'primary' : 'secondary')}
        >
          Toutes
        </Link>
      </nav>
      {!result.ok ? (
        <Alert tone="error">Demandes indisponibles : {result.message}</Alert>
      ) : result.data.length === 0 ? (
        <EmptyState
          title={all ? 'Aucune demande' : 'Aucune demande en attente'}
        />
      ) : (
        <ul aria-label="Liste des demandes" className="flex flex-col gap-3">
          {result.data.map((r) => (
            <li
              key={r.id}
              className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span className="flex flex-col">
                  <Link
                    href={`/admin/boutiques/${r.shop.id}`}
                    className="font-bold text-brand-ink underline underline-offset-4"
                  >
                    {r.shop.name}
                  </Link>
                  <span>
                    {r.from.name} → {r.to.name}, par {r.requestedBy}
                  </span>
                  <span className="text-ink-muted">
                    Le {formatDateTime(r.createdAt, 'UTC')} (UTC)
                  </span>
                  {r.note && (
                    <span className="text-ink-muted">Remarque : {r.note}</span>
                  )}
                </span>
                <Badge tone={r.status === 'pending' ? 'warning' : 'neutral'}>
                  {STATUS[r.status]}
                </Badge>
              </div>
              {r.status === 'pending' && (
                <ResolveRequestForm requestId={r.id} shopName={r.shop.name} />
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function RequestsPage(props: PageProps<'/admin/demandes'>) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Requests {...props} />
    </Suspense>
  );
}
