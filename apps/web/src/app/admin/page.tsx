import {
  formatAmount,
  shareBasisPoints,
  type AdminActivityDto,
  type AdminAlertDto,
  type AdminFinancesDto,
  type AdminOverviewDto,
} from '@nagaw/shared';
import {
  BellRing,
  CircleCheck,
  Crown,
  RefreshCw,
  ShoppingCart,
  Store,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { ColumnChart, ShareBar } from '@/components/charts/column-chart';
import { BarList, Change, KpiTile, percent } from '@/components/dashboard/kpi';
import { Alert } from '@/components/ui/alert';
import { Card, Stat } from '@/components/ui/card';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { requirePlatformAdmin } from '@/lib/admin/load';
import { count, dayLabels, monthLabels } from '@/lib/admin/periods';
import { apiAsUser } from '@/lib/api/server';

const ALERT_LABELS: Record<AdminAlertDto['kind'], string> = {
  plan_request: 'Demande d’offre',
  sync_rejections: 'Synchronisation',
  quota: 'Limite presque atteinte',
  silent_device: 'Téléphone silencieux',
};

/** Offers in their fixed order: the colour follows the offer. */
const PLAN_FILLS = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3'] as const;

const integer = (n: number) => new Intl.NumberFormat('fr').format(n);
const linkClass =
  'inline-flex min-h-12 items-center font-semibold text-brand-ink underline underline-offset-4';

function Alerts({ o }: { o: AdminOverviewDto }) {
  if (o.alerts.length === 0)
    return (
      <p className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3 font-semibold">
        <CircleCheck aria-hidden className="size-6 shrink-0 text-sales-ink" />
        Aucune alerte : tout fonctionne.
      </p>
    );
  return (
    <Card
      title={`${count(o.alerts.length, 'alerte', 'alertes')} à regarder`}
      titleId="alerts"
      icon={BellRing}
      tone="warning"
    >
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
      {o.pendingRequests > 0 && (
        <Link href="/admin/demandes" className={`mt-3 ${linkClass}`}>
          Traiter les demandes d’offre
        </Link>
      )}
    </Card>
  );
}

async function Overview() {
  const admin = await requirePlatformAdmin();
  if (!admin) return null;
  const [overview, finances, activity] = await Promise.all([
    apiAsUser<AdminOverviewDto>(admin.accessToken, { path: '/admin/overview' }),
    apiAsUser<AdminFinancesDto>(admin.accessToken, { path: '/admin/finances' }),
    apiAsUser<AdminActivityDto>(admin.accessToken, { path: '/admin/activity' }),
  ]);
  if (!overview.ok)
    return (
      <Alert tone="error">
        Tableau de bord indisponible : {overview.message}
      </Alert>
    );
  const o = overview.data;
  const f = finances.ok ? finances.data : null;
  const a = activity.ok ? activity.data : null;
  const salesMoney = (minor: number) =>
    a ? formatAmount(minor, a.currency) : String(minor);
  const sold = a ? a.days.reduce((sum, d) => sum + d.amount, 0) : 0;
  const soldCount = a ? a.days.reduce((sum, d) => sum + d.sales, 0) : 0;
  const activeShops = o.shops.active;

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        description="La plateforme d’un coup d’œil : revenus prévus, activité des boutiques, alertes."
      />
      <Alerts o={o} />
      {!finances.ok && (
        <Alert tone="error">Finances indisponibles : {finances.message}</Alert>
      )}
      {!activity.ok && (
        <Alert tone="error">Activité indisponible : {activity.message}</Alert>
      )}

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {f && (
          <KpiTile
            label="Revenu mensuel prévu"
            value={formatAmount(f.expectedMonthlyRevenue, f.currency)}
            tone="brand"
            icon={Wallet}
          >
            {f.months.at(-2) && (
              <Change
                current={f.expectedMonthlyRevenue}
                previous={f.months.at(-2)!.expectedMonthlyRevenue}
              />
            )}
          </KpiTile>
        )}
        {f && (
          <KpiTile
            label="Boutiques payantes"
            value={integer(f.payingShops)}
            tone="accounting"
            icon={Crown}
          >
            <p className="text-base">
              {percent(shareBasisPoints(f.payingShops, f.activeShops))} des
              actives
            </p>
          </KpiTile>
        )}
        {a && (
          <KpiTile
            label="Boutiques qui vendent"
            value={integer(a.shopsSelling.last7Days)}
            tone="stats"
            icon={Store}
          >
            <p className="text-base">
              sur 7 jours, {integer(a.shopsSelling.last30Days)} sur 30 jours
            </p>
          </KpiTile>
        )}
        {a && (
          <KpiTile
            label="Ventes sur 30 jours"
            value={salesMoney(sold)}
            tone="sales"
            icon={ShoppingCart}
          >
            <p className="text-base">{count(soldCount, 'vente', 'ventes')}</p>
          </KpiTile>
        )}
      </dl>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {a && (
          <Card
            title="Ventes des boutiques"
            titleId="sales"
            icon={ShoppingCart}
            tone="sales"
            className="lg:col-span-2"
          >
            <ColumnChart
              title="Montant vendu par jour, toutes boutiques, 30 jours"
              series={[
                { key: 'amount', label: 'Montant vendu', fill: 'bg-chart-1' },
              ]}
              points={a.days.map((d) => ({
                key: d.day,
                ...dayLabels(d.day),
                values: [d.amount],
                detail: count(d.sales, 'vente', 'ventes'),
              }))}
              format={salesMoney}
              empty="Aucune vente enregistrée sur ces 30 jours."
              detailHeader="Ventes"
            />
            {a.otherCurrencyShops > 0 && (
              <p className="mt-3 text-base text-ink-muted">
                Montants en {a.currency} :{' '}
                {count(a.otherCurrencyShops, 'boutique', 'boutiques')} dans une
                autre devise n’y {a.otherCurrencyShops > 1 ? 'sont' : 'est'} pas
                comptée{a.otherCurrencyShops > 1 ? 's' : ''}.
              </p>
            )}
          </Card>
        )}
        {f && (
          <Card title="Offres des boutiques" titleId="plans" icon={Crown}>
            {f.byPlan.length <= PLAN_FILLS.length ? (
              <ShareBar
                label="Boutiques actives par offre"
                parts={f.byPlan.map((p, i) => ({
                  key: p.key,
                  label: p.name,
                  value: p.shops,
                  fill: PLAN_FILLS[i]!,
                  text: `${count(p.shops, 'boutique', 'boutiques')} · ${percent(
                    shareBasisPoints(p.shops, f.activeShops),
                  )}`,
                }))}
              />
            ) : (
              <BarList
                label="Boutiques actives par offre"
                tone="brand"
                rows={f.byPlan.map((p) => ({
                  key: p.key,
                  name: p.name,
                  value: p.shops,
                  text: count(p.shops, 'boutique', 'boutiques'),
                }))}
              />
            )}
            <Link href="/admin/finances" className={`mt-3 ${linkClass}`}>
              Voir les finances
            </Link>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {a && (
          <Card title="Croissance" titleId="growth" icon={TrendingUp}>
            <ColumnChart
              title="Boutiques créées par mois, sur 12 mois"
              series={[
                { key: 'shops', label: 'Boutiques créées', fill: 'bg-chart-1' },
              ]}
              points={a.months.map((m) => ({
                key: m.month,
                ...monthLabels(m.month),
                values: [m.newShops],
                detail: count(m.newUsers, 'compte créé', 'comptes créés'),
              }))}
              format={integer}
              empty="Aucune boutique créée sur ces 12 mois."
              detailHeader="Comptes créés"
            />
          </Card>
        )}
        {a && (
          <Card
            title="Boutiques qui vendent le plus"
            titleId="top"
            icon={Trophy}
            tone="stats"
          >
            {a.topShops.length === 0 ? (
              <p className="text-ink-muted">
                Aucune vente sur les 30 derniers jours.
              </p>
            ) : (
              <BarList
                label="Les cinq boutiques qui ont le plus vendu sur 30 jours"
                tone="stats"
                rows={a.topShops.map((s) => ({
                  key: s.id,
                  name: (
                    <Link
                      href={`/admin/boutiques/${s.id}`}
                      className="text-brand-ink underline underline-offset-4"
                    >
                      {s.name}
                    </Link>
                  ),
                  value: s.amount,
                  text: `${salesMoney(s.amount)} · ${count(s.sales, 'vente', 'ventes')}`,
                }))}
              />
            )}
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Comptes" titleId="accounts" icon={Users}>
          <dl className="grid grid-cols-2 gap-3">
            <Stat label="Boutiques actives" value={integer(activeShops)} />
            <Stat
              label="Boutiques suspendues"
              value={integer(o.shops.suspended)}
            />
            <Stat label="Comptes" value={integer(o.users.total)} />
            <Stat
              label="Comptes créés en 30 jours"
              value={integer(o.users.createdLast30Days)}
            />
          </dl>
          <Link href="/admin/boutiques" className={`mt-3 ${linkClass}`}>
            Voir les boutiques
          </Link>
        </Card>
        <Card title="Synchronisation (7 jours)" titleId="sync" icon={RefreshCw}>
          <dl className="grid grid-cols-2 gap-3">
            <Stat label="Lots reçus" value={integer(o.sync.batches)} />
            <Stat
              label="Taux de refus"
              value={percent(o.sync.rejectionBasisPoints)}
            />
            <Stat
              label="Opérations acceptées"
              value={integer(o.sync.accepted)}
            />
            <Stat
              label="Opérations refusées"
              value={integer(o.sync.rejected)}
            />
          </dl>
          <Link href="/admin/synchronisation" className={`mt-3 ${linkClass}`}>
            Voir le détail
          </Link>
        </Card>
      </div>
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
