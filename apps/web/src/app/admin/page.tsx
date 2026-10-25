import type { AdminAlertDto, AdminOverviewDto } from '@nagaw/shared';
import { BellRing, RefreshCw, Store, Users } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { Card, Stat } from '@/components/ui/card';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { requirePlatformAdmin } from '@/lib/admin/load';
import { apiAsUser } from '@/lib/api/server';

const ALERT_LABELS: Record<AdminAlertDto['kind'], string> = {
  plan_request: 'Demande d’offre',
  sync_rejections: 'Synchronisation',
  quota: 'Limite presque atteinte',
  silent_device: 'Téléphone silencieux',
};

const percent = (basisPoints: number) =>
  `${new Intl.NumberFormat('fr', { maximumFractionDigits: 1 }).format(basisPoints / 100)} %`;

async function Overview() {
  const admin = await requirePlatformAdmin();
  if (!admin) return null;
  const result = await apiAsUser<AdminOverviewDto>(admin.accessToken, {
    path: '/admin/overview',
  });
  if (!result.ok)
    return (
      <Alert tone="error">
        Tableau de bord indisponible : {result.message}
      </Alert>
    );
  const o = result.data;
  return (
    <>
      <PageHeader
        title="Tableau de bord de la plateforme"
        description="Comptes, offres et santé de la synchronisation, sans le contenu des boutiques."
      />
      <Card title="Alertes" titleId="alerts" icon={BellRing}>
        {o.alerts.length === 0 ? (
          <p className="text-ink-muted">Aucune alerte.</p>
        ) : (
          <ul
            aria-labelledby="alerts"
            className="flex flex-col divide-y divide-line"
          >
            {o.alerts.map((alert, index) => (
              <li key={index} className="flex flex-col gap-0.5 py-3 first:pt-0">
                <span className="font-bold">
                  {ALERT_LABELS[alert.kind]}
                  {alert.shop && (
                    <>
                      {' · '}
                      <Link
                        href={`/admin/boutiques/${alert.shop.id}`}
                        className="text-brand-ink underline underline-offset-4"
                      >
                        {alert.shop.name}
                      </Link>
                    </>
                  )}
                </span>
                <span>{alert.message}</span>
              </li>
            ))}
          </ul>
        )}
        {o.pendingRequests > 0 && (
          <Link
            href="/admin/demandes"
            className="mt-3 inline-flex min-h-12 items-center font-semibold text-brand-ink underline underline-offset-4"
          >
            Traiter les demandes d’offre
          </Link>
        )}
      </Card>
      <Card title="Boutiques" titleId="shops" icon={Store}>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label="Actives" value={o.shops.active} />
          <Stat label="Suspendues" value={o.shops.suspended} />
          <Stat label="Créées en 30 jours" value={o.shops.createdLast30Days} />
          {o.shops.byPlan.map((p) => (
            <Stat key={p.key} label={`Offre ${p.name}`} value={p.count} />
          ))}
        </dl>
      </Card>
      <Card title="Personnes" titleId="users" icon={Users}>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Stat label="Comptes" value={o.users.total} />
          <Stat label="Créés en 30 jours" value={o.users.createdLast30Days} />
        </dl>
      </Card>
      <Card title="Synchronisation (7 jours)" titleId="sync" icon={RefreshCw}>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Lots reçus" value={o.sync.batches} />
          <Stat label="Opérations acceptées" value={o.sync.accepted} />
          <Stat label="Opérations refusées" value={o.sync.rejected} />
          <Stat
            label="Taux de refus"
            value={percent(o.sync.rejectionBasisPoints)}
          />
        </dl>
        <Link
          href="/admin/synchronisation"
          className="mt-3 inline-flex min-h-12 items-center font-semibold text-brand-ink underline underline-offset-4"
        >
          Voir le détail
        </Link>
      </Card>
    </>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Overview />
    </Suspense>
  );
}
