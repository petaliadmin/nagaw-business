import type { AdminSyncDto } from '@nagaw/shared';
import { Smartphone, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { requirePlatformAdmin } from '@/lib/admin/load';
import { apiAsUser } from '@/lib/api/server';
import { formatCalendarDate, formatDateTime } from '@/lib/format';
import { ScrollRegion } from '@/components/ui/scroll-region';

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
  return (
    <>
      <PageHeader
        title="Synchronisation"
        description="Ce que les téléphones de caisse ont envoyé ces 14 derniers jours (jours UTC)."
      />
      <Card>
        <ScrollRegion label="Envois par jour">
          <table className="w-full text-left">
            <caption className="mb-2 text-left text-lg font-bold">
              Envois par jour
            </caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="py-2 pr-3">
                  Jour
                </th>
                <th scope="col" className="py-2 pr-3 text-right">
                  Lots
                </th>
                <th scope="col" className="py-2 pr-3 text-right">
                  Acceptées
                </th>
                <th scope="col" className="py-2 pr-3 text-right">
                  Doublons
                </th>
                <th scope="col" className="py-2 text-right">
                  Refusées
                </th>
              </tr>
            </thead>
            <tbody>
              {s.days.map((d) => (
                <tr key={d.day} className="border-b border-line">
                  <th scope="row" className="py-2 pr-3 font-normal">
                    {formatCalendarDate(d.day)}
                  </th>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {d.batches}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {d.accepted}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {d.duplicates}
                  </td>
                  <td
                    className={`py-2 text-right tabular-nums ${d.rejected > 0 ? 'font-bold text-danger-ink' : ''}`}
                  >
                    {d.rejected}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollRegion>
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
