import {
  formatAmount,
  shareBasisPoints,
  type AdminFinancesDto,
} from '@nagaw/shared';
import {
  ArrowUpDown,
  CalendarRange,
  Crown,
  Inbox,
  Store,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { ColumnChart, ShareBar } from '@/components/charts/column-chart';
import { Change, KpiTile, percent } from '@/components/dashboard/kpi';
import { Alert } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { Table } from '@/components/ui/table';
import { requirePlatformAdmin } from '@/lib/admin/load';
import { count, monthLabels } from '@/lib/admin/periods';
import { apiAsUser } from '@/lib/api/server';

/** Offers in their fixed order: the colour follows the offer. */
const PLAN_FILLS = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3'] as const;

async function Finances() {
  const admin = await requirePlatformAdmin();
  if (!admin) return null;
  const result = await apiAsUser<AdminFinancesDto>(admin.accessToken, {
    path: '/admin/finances',
  });
  if (!result.ok)
    return (
      <Alert tone="error">Finances indisponibles : {result.message}</Alert>
    );
  const f = result.data;
  const money = (minor: number) => formatAmount(minor, f.currency);
  const previous = f.months.at(-2);
  const paid = f.byPlan.filter((p) => p.monthlyPrice > 0);
  return (
    <>
      <PageHeader
        title="Finances"
        description="Ce que les offres en cours doivent rapporter chaque mois."
      />
      <Alert>
        Montants attendus d’après les offres des boutiques actives, aux prix
        d’aujourd’hui. Les paiements sont reçus hors de l’application et n’y
        sont pas enregistrés : ce n’est pas de l’argent encaissé.
      </Alert>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          label="Revenu mensuel prévu"
          value={money(f.expectedMonthlyRevenue)}
          tone="brand"
          icon={Wallet}
        >
          {previous && (
            <Change
              current={f.expectedMonthlyRevenue}
              previous={previous.expectedMonthlyRevenue}
            />
          )}
        </KpiTile>
        <KpiTile
          label="Sur un an à ce rythme"
          value={money(f.expectedMonthlyRevenue * 12)}
          tone="accounting"
          icon={CalendarRange}
        />
        <KpiTile
          label="Par boutique payante"
          value={
            f.payingShops > 0
              ? money(Math.round(f.expectedMonthlyRevenue / f.payingShops))
              : '—'
          }
          tone="stats"
          icon={TrendingUp}
        >
          <p className="text-base">en moyenne, par mois</p>
        </KpiTile>
        <KpiTile
          label="Boutiques payantes"
          value={f.payingShops}
          tone="sales"
          icon={Store}
        >
          <p className="text-base">
            {percent(shareBasisPoints(f.payingShops, f.activeShops))} des{' '}
            {count(f.activeShops, 'boutique active', 'boutiques actives')}
          </p>
        </KpiTile>
      </dl>
      <Card
        title="Revenu mensuel prévu, sur 12 mois"
        titleId="history"
        icon={TrendingUp}
      >
        <ColumnChart
          title="Revenu prévu à la fin de chaque mois"
          series={[
            { key: 'revenue', label: 'Revenu prévu', fill: 'bg-chart-1' },
          ]}
          points={f.months.map((m) => ({
            key: m.month,
            ...monthLabels(m.month),
            values: [m.expectedMonthlyRevenue],
            detail: count(
              m.payingShops,
              'boutique payante',
              'boutiques payantes',
            ),
          }))}
          format={money}
          empty="Aucune boutique payante sur ces 12 mois."
          detailHeader="Boutiques payantes"
        />
        <p className="mt-3 text-base text-ink-muted">
          Reconstitué d’après l’historique des changements d’offre et des
          suspensions, aux prix d’aujourd’hui ; le mois en cours compte les
          offres de ce jour.
        </p>
      </Card>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Revenu par offre" titleId="plans" icon={Crown}>
          {paid.length > 0 && paid.length <= PLAN_FILLS.length ? (
            <ShareBar
              label="Part de chaque offre dans le revenu prévu"
              parts={paid.map((p) => ({
                key: p.key,
                label: p.name,
                value: p.expectedMonthlyRevenue,
                fill: PLAN_FILLS[f.byPlan.indexOf(p) % PLAN_FILLS.length]!,
                text: `${money(p.expectedMonthlyRevenue)} · ${percent(
                  shareBasisPoints(
                    p.expectedMonthlyRevenue,
                    f.expectedMonthlyRevenue,
                  ),
                )}`,
              }))}
            />
          ) : (
            <p className="text-ink-muted">Aucune offre payante en cours.</p>
          )}
        </Card>
        <Card title="Demandes d’offre" titleId="pending" icon={Inbox}>
          {f.pending.requests === 0 ? (
            <p className="text-ink-muted">Aucune demande en attente.</p>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-2xl font-extrabold">
                {f.pending.expectedMonthlyChange >= 0 ? '+' : '−'}
                {money(Math.abs(f.pending.expectedMonthlyChange))} par mois
              </p>
              <p>
                si {f.pending.requests > 1 ? 'les' : 'la'}{' '}
                {count(f.pending.requests, 'demande', 'demandes')} en attente{' '}
                {f.pending.requests > 1 ? 'sont acceptées' : 'est acceptée'}.
              </p>
              <Link
                href="/admin/demandes"
                className="inline-flex min-h-12 items-center font-semibold text-brand-ink underline underline-offset-4"
              >
                Traiter les demandes
              </Link>
            </div>
          )}
        </Card>
      </div>
      <Table
        caption="Détail par offre"
        rows={f.byPlan}
        rowKey={(p) => p.key}
        columns={[
          { header: 'Offre', cell: (p) => p.name },
          { header: 'Prix par mois', cell: (p) => money(p.monthlyPrice) },
          { header: 'Boutiques actives', cell: (p) => p.shops },
          {
            header: 'Revenu prévu par mois',
            cell: (p) => money(p.expectedMonthlyRevenue),
          },
        ]}
      />
      <Card title="Changements d’offre" titleId="moves" icon={ArrowUpDown}>
        <ColumnChart
          title="Offres montées et descendues, par mois"
          series={[
            {
              key: 'up',
              label: 'Vers une offre plus chère',
              fill: 'bg-chart-1',
            },
            {
              key: 'down',
              label: 'Vers une offre moins chère',
              fill: 'bg-chart-2',
            },
          ]}
          points={f.months.map((m) => ({
            key: m.month,
            ...monthLabels(m.month),
            values: [m.upgrades, m.downgrades],
          }))}
          format={(n) => new Intl.NumberFormat('fr').format(n)}
          empty="Aucun changement d’offre sur ces 12 mois."
        />
      </Card>
    </>
  );
}

export default function FinancesPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Finances />
    </Suspense>
  );
}
