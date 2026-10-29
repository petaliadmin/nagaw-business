import { shareBasisPoints, type AdminSyncDto } from '@nagaw/shared';
import {
  BarChart3,
  CircleCheck,
  RefreshCw,
  Smartphone,
  TriangleAlert,
} from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { ColumnChart } from '@/components/charts/column-chart';
import { KpiTile, percent } from '@/components/dashboard/kpi';
import { Alert } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { requirePlatformAdmin } from '@/lib/admin/load';
import { count, dayLabels } from '@/lib/admin/periods';
import { apiAsUser } from '@/lib/api/server';
import { formatDateTime } from '@/lib/format';

async function Sync() {
  const admin = await requirePlatformAdmin();
  if (!admin) return null;
  const result = await apiAsUser<AdminSyncDto>(admin.accessToken, {
    path: '/admin/sync?days=14',
  });
  if (!result.ok)
    return (
      <Alert tone="error">
        Synchronisation indisponible : {result.message}
      </Alert>
    );
  const s = result.data;
  const sum = (pick: (d: AdminSyncDto['days'][number]) => number) =>
    s.days.reduce((total, d) => total + pick(d), 0);
  const accepted = sum((d) => d.accepted);
  const rejected = sum((d) => d.rejected);
  const integer = (n: number) => new Intl.NumberFormat('fr').format(n);
  return (
    <>
      <PageHeader
        title="Synchronisation"
        description="Ce que les téléphones de caisse ont envoyé ces 14 derniers jours (jours UTC)."
      />
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          label="Lots reçus"
          value={integer(sum((d) => d.batches))}
          tone="brand"
          icon={RefreshCw}
        />
        <KpiTile
          label="Acceptées"
          value={integer(accepted)}
          tone="sales"
          icon={CircleCheck}
        />
        <KpiTile
          label="Refusées"
          value={integer(rejected)}
          tone={rejected > 0 ? 'danger' : 'accounting'}
          icon={TriangleAlert}
        >
          <p className="text-base">
            {percent(shareBasisPoints(rejected, accepted + rejected))} des
            opérations
          </p>
        </KpiTile>
        <KpiTile
          label="Téléphones silencieux"
          value={integer(s.silentDevices.length)}
          tone={s.silentDevices.length > 0 ? 'warning' : 'accounting'}
          icon={Smartphone}
        />
      </dl>
      <Card
        title="Opérations reçues par jour"
        titleId="per-day"
        icon={BarChart3}
      >
        <ColumnChart
          title="Opérations acceptées et refusées, par jour"
          series={[
            { key: 'accepted', label: 'Acceptées', fill: 'bg-chart-1' },
            { key: 'rejected', label: 'Refusées', fill: 'bg-chart-2' },
          ]}
          points={s.days.map((d) => ({
            key: d.day,
            ...dayLabels(d.day),
            values: [d.accepted, d.rejected],
            detail: `${count(d.batches, 'lot', 'lots')}, ${count(d.duplicates, 'doublon', 'doublons')}`,
          }))}
          format={integer}
          empty="Aucune opération reçue sur ces 14 jours."
          detailHeader="Lots et doublons"
        />
      </Card>
      <Card title="Motifs de refus" titleId="reasons" icon={TriangleAlert}>
        {s.reasons.length === 0 ? (
          <p className="text-ink-muted">Aucune opération refusée.</p>
        ) : (
          <ul
            aria-labelledby="reasons"
            className="flex flex-col divide-y divide-line"
          >
            {s.reasons.map((r) => (
              <li
                key={r.code}
                className="flex flex-wrap justify-between gap-2 py-2"
              >
                <span>
                  <span className="font-semibold">{r.code}</span> — {r.example}
                </span>
                <span className="font-bold tabular-nums">{r.count}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Téléphones silencieux" titleId="silent" icon={Smartphone}>
        {s.silentDevices.length === 0 ? (
          <p className="text-ink-muted">
            Tous les téléphones ont envoyé récemment.
          </p>
        ) : (
          <ul
            aria-labelledby="silent"
            className="flex flex-col divide-y divide-line"
          >
            {s.silentDevices.map((d, index) => (
              <li
                key={index}
                className="flex flex-wrap justify-between gap-2 py-2"
              >
                <span>
                  <Link
                    href={`/admin/boutiques/${d.shop.id}`}
                    className="font-semibold text-brand-ink underline underline-offset-4"
                  >
                    {d.shop.name}
                  </Link>{' '}
                  · {d.label}
                </span>
                <span className="text-ink-muted">
                  {d.lastSyncedAt
                    ? `Dernier envoi : ${formatDateTime(d.lastSyncedAt, 'UTC')} (UTC)`
                    : 'Jamais'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

export default function SyncPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Sync />
    </Suspense>
  );
}
