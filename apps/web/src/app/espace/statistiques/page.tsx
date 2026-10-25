import {
  formatAmount,
  roleHasPermission,
  type ShopSummaryDto,
  type StatsSummaryDto,
} from '@nagaw/shared';
import { ChartColumn, PackageX, Store, Trophy } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { PeriodPicker } from '@/components/treasury/period-picker';
import { SalesChart } from '@/components/treasury/sales-chart';
import { Alert } from '@/components/ui/alert';
import { Card, Stat } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { apiAsUser } from '@/lib/api/server';
import { formatQuantity } from '@/lib/catalog/labels';
import { formatCalendarDate, todayIn } from '@/lib/format';
import { PAYMENT_LABELS } from '@/lib/sales/labels';
import { resolvePeriod } from '@/lib/treasury/period';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { ScrollRegion } from '@/components/ui/scroll-region';

export const metadata: Metadata = { title: 'Statistiques — Nagaw Business' };

function percent(basisPoints: number): string {
  return `${new Intl.NumberFormat('fr', { maximumFractionDigits: 0 }).format(basisPoints / 100)} %`;
}

async function Statistics({ searchParams }: PageProps<'/espace/statistiques'>) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken, me } = workspace;
  if (!roleHasPermission(organization.role, 'stats.read'))
    return (
      <>
        <PageHeader title="Statistiques" />
        <Alert>
          Votre rôle ne donne pas accès aux statistiques de la boutique.
        </Alert>
      </>
    );
  const period = resolvePeriod(
    await searchParams,
    todayIn(organization.timezone),
  );
  const query = new URLSearchParams({ from: period.from, to: period.to });
  const [stats, shops] = await Promise.all([
    apiAsUser<StatsSummaryDto>(accessToken, {
      path: `/stats/summary?${query}`,
      organizationId: organization.id,
    }),
    me.organizations.length > 1
      ? apiAsUser<ShopSummaryDto[]>(accessToken, {
          path: `/stats/shops?${query}`,
        })
      : null,
  ]);
  const currency = organization.defaultCurrency;
  const money = (value: number) => formatAmount(value, currency);
  const range =
    period.from === period.to
      ? formatCalendarDate(period.from)
      : `du ${formatCalendarDate(period.from)} au ${formatCalendarDate(period.to)}`;

  return (
    <>
      <PageHeader
        title="Statistiques"
        description={`Ventes de la boutique, ${range}.`}
      />
      <PeriodPicker
        path="/espace/statistiques"
        current={period.key}
        from={period.from}
        to={period.to}
      />

      {!stats.ok ? (
        <Alert tone="error">Statistiques indisponibles : {stats.message}</Alert>
      ) : (
        <>
          <Card title="L’essentiel" titleId="stats-main" icon={ChartColumn}>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Stat
                label="Chiffre d’affaires"
                value={money(stats.data.revenue)}
              />
              <Stat label="Nombre de ventes" value={stats.data.salesCount} />
              <Stat
                label="Panier moyen"
                value={money(stats.data.averageBasket)}
              />
              <Stat
                label="Marge brute"
                value={money(stats.data.margin.amount)}
              />
              <Stat label="Dépenses" value={money(stats.data.expenses)} />
              <Stat
                label="Dont taxes encaissées"
                value={money(stats.data.taxTotal)}
              />
            </dl>
            {stats.data.revenue > 0 &&
              stats.data.margin.coverageBasisPoints < 10000 && (
                <p className="mt-3 text-ink-muted">
                  La marge est calculée sur{' '}
                  {percent(stats.data.margin.coverageBasisPoints)} des ventes :
                  pour le reste, le prix d’achat des produits n’était pas connu
                  au moment de la vente.{' '}
                  <Link
                    href="/espace/produits"
                    className="font-semibold text-brand-ink underline"
                  >
                    Ajoutez les prix d’achat
                  </Link>{' '}
                  pour une marge complète.
                </p>
              )}
          </Card>

          <Card>
            <SalesChart days={stats.data.days} currency={currency} />
          </Card>

          <section aria-labelledby="by-method" className="flex flex-col gap-3">
            <h2 id="by-method" className="text-xl font-bold">
              Par moyen de paiement
            </h2>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(['cash', 'mobile_money', 'card', 'credit'] as const).map(
                (m) => (
                  <Stat
                    key={m}
                    label={PAYMENT_LABELS[m]}
                    value={money(stats.data.byMethod[m])}
                  />
                ),
              )}
            </dl>
          </section>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card title="Les plus vendus" titleId="top-products" icon={Trophy}>
              {stats.data.topProducts.length === 0 ? (
                <EmptyState title="Aucune vente sur cette période" />
              ) : (
                <ol
                  aria-labelledby="top-products"
                  className="flex flex-col divide-y divide-line"
                >
                  {stats.data.topProducts.map((p, index) => (
                    <li
                      key={p.productId}
                      className="flex justify-between gap-3 py-2 first:pt-0"
                    >
                      <span>
                        <span className="font-bold">{index + 1}.</span>{' '}
                        <Link
                          href={`/espace/produits/${p.productId}`}
                          className="inline-flex min-h-12 items-center font-semibold underline-offset-4 hover:underline"
                        >
                          {p.label}
                        </Link>
                        <span className="block text-ink-muted">
                          {formatQuantity(p.quantity, p.unit)}
                        </span>
                      </span>
                      <span className="font-bold tabular-nums">
                        {money(p.revenue)}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
            <Card
              title="Ne se vendent pas"
              titleId="slow-products"
              icon={PackageX}
            >
              {stats.data.slowProducts.length === 0 ? (
                <EmptyState title="Tout ce qui est en stock s’est vendu sur la période" />
              ) : (
                <>
                  <p className="mb-3 text-ink-muted">
                    En stock, mais aucune vente sur la période.
                  </p>
                  <ul
                    aria-labelledby="slow-products"
                    className="flex flex-col divide-y divide-line"
                  >
                    {stats.data.slowProducts.map((p) => (
                      <li
                        key={p.id}
                        className="flex justify-between gap-3 py-2 first:pt-0"
                      >
                        <Link
                          href={`/espace/produits/${p.id}`}
                          className="inline-flex min-h-12 items-center font-semibold underline-offset-4 hover:underline"
                        >
                          {p.name}
                        </Link>
                        <span className="text-ink-muted">
                          {formatQuantity(p.stockQuantity, p.unit)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>
          </div>
        </>
      )}

      {shops && (
        <Card title="Vos boutiques" titleId="shops" icon={Store}>
          {!shops.ok ? (
            <Alert tone="error">
              Comparaison indisponible : {shops.message}
            </Alert>
          ) : shops.data.length === 0 ? (
            <p className="text-ink-muted">
              Aucune autre boutique dont vous voyez les chiffres.
            </p>
          ) : (
            <ScrollRegion label="Ventes de vos boutiques">
              <table className="w-full text-left">
                <caption className="sr-only">Ventes de vos boutiques</caption>
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="py-2 pr-3">
                      Boutique
                    </th>
                    <th scope="col" className="py-2 pr-3 text-right">
                      Aujourd’hui
                    </th>
                    <th scope="col" className="py-2 text-right">
                      Sur la période
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shops.data.map((shop) => (
                    <tr
                      key={shop.organizationId}
                      className="border-b border-line"
                    >
                      <th scope="row" className="py-2 pr-3 font-semibold">
                        {shop.name}
                        {shop.organizationId === organization.id && (
                          <span className="block font-normal text-ink-muted">
                            boutique ouverte
                          </span>
                        )}
                      </th>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatAmount(shop.today.revenue, shop.currency)}
                        <span className="block text-ink-muted">
                          {shop.today.count} ventes
                        </span>
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {formatAmount(shop.period.revenue, shop.currency)}
                        <span className="block text-ink-muted">
                          {shop.period.count} ventes
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollRegion>
          )}
        </Card>
      )}
    </>
  );
}

export default function StatisticsPage(
  props: PageProps<'/espace/statistiques'>,
) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Statistics {...props} />
    </Suspense>
  );
}
