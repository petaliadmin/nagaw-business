import type { AdminShopDto, PlanDto } from '@nagaw/shared';
import { Ban, Crown, Smartphone } from 'lucide-react';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, Stat } from '@/components/ui/card';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { requirePlatformAdmin } from '@/lib/admin/load';
import { apiAsUser } from '@/lib/api/server';
import { formatDateTime } from '@/lib/format';
import { SetPlanForm, SuspendForm } from '../../forms';

const REQUEST_STATUS = {
  pending: 'En attente',
  cancelled: 'Annulée par la boutique',
  done: 'Acceptée',
  rejected: 'Refusée',
} as const;

async function Shop({ params }: PageProps<'/admin/boutiques/[id]'>) {
  const admin = await requirePlatformAdmin();
  if (!admin) return null;
  const { id } = await params;
  const [shop, plans] = await Promise.all([
    apiAsUser<AdminShopDto>(admin.accessToken, {
      path: `/admin/shops/${encodeURIComponent(id)}`,
    }),
    apiAsUser<PlanDto[]>(admin.accessToken, { path: '/plans' }),
  ]);
  if (!shop.ok && shop.status === 404) notFound();
  if (!shop.ok)
    return <Alert tone="error">Boutique indisponible : {shop.message}</Alert>;
  const s = shop.data;
  const when = (iso: string) => `${formatDateTime(iso, 'UTC')} (UTC)`;
  return (
    <>
      <PageHeader
        title={s.name}
        description={`${s.ownerEmails.join(', ') || 'Sans propriétaire actif'} · créée le ${when(s.createdAt)} · ${s.timezone} · ${s.currency}`}
      />
      {s.suspension && (
        <Alert tone="warning">
          Suspendue le {when(s.suspension.at)} : {s.suspension.reason}
        </Alert>
      )}
      <Card title={`Offre ${s.plan.name}`} titleId="plan" icon={Crown}>
        <dl className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat
            label="Produits"
            value={`${s.usage.products} / ${s.limits.products}`}
          />
          <Stat
            label="Personnes"
            value={`${s.usage.members} / ${s.limits.members}`}
          />
          <Stat
            label="Téléphones"
            value={`${s.usage.devices} / ${s.limits.devices}`}
          />
        </dl>
        {plans.ok ? (
          <SetPlanForm
            shopId={s.id}
            currentPlan={s.plan.key}
            plans={plans.data.map((p) => ({ value: p.key, label: p.name }))}
          />
        ) : (
          <Alert tone="error">Offres indisponibles : {plans.message}</Alert>
        )}
        {s.requests.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-lg font-bold">Demandes</h3>
            <ul className="flex flex-col divide-y divide-line">
              {s.requests.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap justify-between gap-2 py-2"
                >
                  <span>
                    {r.from.name} → {r.to.name}, par {r.requestedBy}, le{' '}
                    {when(r.createdAt)}
                    {r.note ? ` · ${r.note}` : ''}
                  </span>
                  <Badge tone={r.status === 'pending' ? 'warning' : 'neutral'}>
                    {REQUEST_STATUS[r.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
      <Card title="Téléphones de caisse" titleId="devices" icon={Smartphone}>
        {s.devices.length === 0 ? (
          <p className="text-ink-muted">Aucun téléphone enregistré.</p>
        ) : (
          <ul
            aria-labelledby="devices"
            className="flex flex-col divide-y divide-line"
          >
            {s.devices.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap justify-between gap-2 py-2"
              >
                <span className="font-semibold">{d.label}</span>
                <span className="text-ink-muted">
                  {d.revoked
                    ? 'Retiré'
                    : d.lastSyncedAt
                      ? `Dernier envoi : ${when(d.lastSyncedAt)}`
                      : 'Aucun envoi'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card
        title={s.status === 'suspended' ? 'Réactiver' : 'Suspendre'}
        titleId="suspend"
        icon={Ban}
      >
        <p className="mb-4 text-ink-muted">
          {s.status === 'suspended'
            ? 'Les membres retrouvent l’accès à la boutique, avec toutes ses données.'
            : 'Les membres n’ont plus accès à la boutique ; rien n’est effacé. Le motif est inscrit dans son historique.'}
        </p>
        <SuspendForm shopId={s.id} suspended={s.status === 'suspended'} />
      </Card>
    </>
  );
}

export default function ShopPage(props: PageProps<'/admin/boutiques/[id]'>) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Shop {...props} />
    </Suspense>
  );
}
