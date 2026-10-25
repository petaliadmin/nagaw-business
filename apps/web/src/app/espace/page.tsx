import {
  formatAmount,
  roleHasPermission,
  shareBasisPoints,
  type AuditLogDto,
  type MemberDto,
  type Paginated,
  type SalesDaySummaryDto,
  type StatsSummaryDto,
  type StockSummaryDto,
  type TreasuryDto,
} from '@nagaw/shared';
import {
  Banknote,
  CalendarDays,
  ChartColumn,
  Coins,
  CreditCard,
  HandCoins,
  History,
  Package,
  PackageX,
  PiggyBank,
  Receipt,
  ShoppingBasket,
  TriangleAlert,
  Trophy,
  Wallet,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { BarList, Change, KpiTile, percent } from '@/components/dashboard/kpi';
import { SellFab } from '@/components/dashboard/sell-fab';
import { PeriodPicker } from '@/components/treasury/period-picker';
import { SalesChart } from '@/components/treasury/sales-chart';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button-link';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import type { ApiResult } from '@/lib/api/call-api';
import { apiAsUser } from '@/lib/api/server';
import {
  formatQuantity,
  STOCK_LEVEL_LABELS,
  STOCK_LEVEL_TONES,
} from '@/lib/catalog/labels';
import {
  formatCalendarDate,
  formatDate,
  formatDateTime,
  todayIn,
} from '@/lib/format';
import { auditActionLabel } from '@/lib/labels';
import { PAYMENT_LABELS } from '@/lib/sales/labels';
import { previousPeriod, resolvePeriod } from '@/lib/treasury/period';
import { requireReadyWorkspace } from '@/lib/workspace/load';

export const metadata: Metadata = {
  title: 'Tableau de bord — Nagaw Business',
};

const LINK =
  'inline-flex min-h-12 items-center font-bold text-brand-ink underline underline-offset-4';

function range(from: string, to: string): string {
  return from === to
    ? `le ${formatCalendarDate(from)}`
    : `du ${formatCalendarDate(from)} au ${formatCalendarDate(to)}`;
}

/** Today's sales, whatever the period of the figures. */
function TodayCard({
  summary,
  currency,
}: {
  summary: ApiResult<SalesDaySummaryDto>;
  currency: string;
}) {
  return (
    <section
      aria-labelledby="today"
      className="flex flex-col gap-4 rounded-3xl bg-sales-strong p-4 text-white shadow-sm md:flex-row md:items-center md:justify-between md:p-6"
    >
      <div className="flex flex-col gap-3">
        <h2
          id="today"
          className="flex items-center gap-2 text-xl font-extrabold"
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-white/20">
            <CalendarDays aria-hidden className="size-5" />
          </span>
          Aujourd’hui
        </h2>
        {!summary.ok ? (
          <Alert tone="error">Ventes indisponibles : {summary.message}</Alert>
        ) : (
          <dl className="flex flex-wrap gap-x-8 gap-y-2">
            <div>
              <dt className="text-base">Ventes</dt>
              <dd className="text-2xl font-extrabold tabular-nums">
                {summary.data.count}
              </dd>
            </div>
            <div>
              <dt className="text-base">Montant des ventes</dt>
              <dd className="text-2xl font-extrabold tabular-nums">
                {formatAmount(summary.data.total, currency)}
              </dd>
            </div>
          </dl>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/espace/ventes" variant="outlineOnDark">
          Voir les ventes du jour
        </ButtonLink>
      </div>
    </section>
  );
}

/**
 * The key figures of the period, first on the page, each compared with
 * the period before: two per row on a phone, so that they show at once.
 */
function Essentials({
  stats,
  before,
  beforeRange,
  currency,
}: {
  stats: StatsSummaryDto;
  before: ApiResult<StatsSummaryDto>;
  beforeRange: string;
  currency: string;
}) {
  const money = (value: number) => formatAmount(value, currency);
  const previous = before.ok ? before.data : null;
  const change = (
    pick: (s: StatsSummaryDto) => number,
    higherIsWorse = false,
  ) =>
    previous && (
      <Change
        current={pick(stats)}
        previous={pick(previous)}
        higherIsWorse={higherIsWorse}
      />
    );
  const marginRate = shareBasisPoints(
    stats.margin.amount,
    stats.margin.costedRevenue,
  );
  const profit = (s: StatsSummaryDto) => s.margin.amount - s.expenses;

  return (
    <section aria-labelledby="essentials" className="flex flex-col gap-3">
      <h2 id="essentials" className="sr-only">
        L’essentiel
      </h2>
      <dl className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
        <KpiTile
          label="Chiffre d’affaires"
          value={money(stats.revenue)}
          tone="sales"
          icon={Banknote}
        >
          {change((s) => s.revenue)}
        </KpiTile>
        <KpiTile
          label="Nombre de ventes"
          value={stats.salesCount}
          tone="stock"
          icon={Receipt}
        >
          {change((s) => s.salesCount)}
        </KpiTile>
        <KpiTile
          label="Panier moyen"
          value={money(stats.averageBasket)}
          tone="invoices"
          icon={ShoppingBasket}
        >
          {change((s) => s.averageBasket)}
        </KpiTile>
        <KpiTile
          label="Marge brute"
          value={money(stats.margin.amount)}
          tone="stats"
          icon={ChartColumn}
        >
          {stats.margin.costedRevenue > 0 && (
            <p className="text-base">{percent(marginRate)} des ventes</p>
          )}
          {change((s) => s.margin.amount)}
        </KpiTile>
        <KpiTile
          label="Dépenses"
          value={money(stats.expenses)}
          tone="accounting"
          icon={HandCoins}
        >
          {change((s) => s.expenses, true)}
        </KpiTile>
        <KpiTile
          label="Bénéfice estimé"
          value={money(profit(stats))}
          tone="brand"
          icon={PiggyBank}
        >
          {change(profit)}
        </KpiTile>
      </dl>
      <p className="text-ink-muted">
        {before.ok
          ? `Comparé à la période d’avant, ${beforeRange}. `
          : `Comparaison indisponible : ${before.message} `}
        Bénéfice estimé : marge brute moins les dépenses.
      </p>
      {stats.revenue > 0 && stats.margin.coverageBasisPoints < 10000 && (
        <p className="text-ink-muted">
          La marge est calculée sur {percent(stats.margin.coverageBasisPoints)}{' '}
          des ventes : pour le reste, le prix d’achat des produits n’était pas
          connu au moment de la vente.{' '}
          <Link
            href="/espace/produits"
            className="font-semibold text-brand-ink underline"
          >
            Ajoutez les prix d’achat
          </Link>{' '}
          pour une marge complète.
        </p>
      )}
    </section>
  );
}

/** Sales day by day, the products that sell or not, the means of payment. */
function Details({
  stats,
  currency,
}: {
  stats: StatsSummaryDto;
  currency: string;
}) {
  const money = (value: number) => formatAmount(value, currency);
  const paid = Object.values(stats.byMethod).reduce((t, v) => t + v, 0);
  return (
    <>
      <Card>
        <SalesChart days={stats.days} currency={currency} />
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card
          title="Produits qui rapportent le plus"
          titleId="top-products"
          icon={Trophy}
          tone="stats"
        >
          {stats.topProducts.length === 0 ? (
            <EmptyState title="Aucune vente sur cette période" />
          ) : (
            <BarList
              label="Produits qui rapportent le plus"
              tone="stats"
              rows={stats.topProducts.slice(0, 5).map((p) => ({
                key: p.productId,
                name: (
                  <Link
                    href={`/espace/produits/${p.productId}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {p.label}
                    <span className="block font-normal text-ink-muted">
                      {formatQuantity(p.quantity, p.unit)} vendu
                      {p.quantity > 1 ? 's' : ''}
                    </span>
                  </Link>
                ),
                value: p.revenue,
                text: money(p.revenue),
              }))}
            />
          )}
          <Link href="/espace/statistiques" className={`${LINK} mt-3`}>
            Voir toutes les statistiques
          </Link>
        </Card>

        <Card
          title="Ne se vendent pas"
          titleId="slow-products"
          icon={PackageX}
          tone="stock"
        >
          {stats.slowProducts.length === 0 ? (
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
                {stats.slowProducts.slice(0, 5).map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-x-3 py-1 first:pt-0"
                  >
                    <Link
                      href={`/espace/produits/${p.id}`}
                      className="inline-flex min-h-12 items-center font-semibold underline-offset-4 hover:underline"
                    >
                      {p.name}
                    </Link>
                    <span className="text-ink-muted">
                      Reste {formatQuantity(p.stockQuantity, p.unit)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      <Card
        title="Comment vos clients paient"
        titleId="by-method"
        icon={CreditCard}
        tone="sales"
      >
        {paid === 0 ? (
          <EmptyState title="Aucun paiement sur cette période" />
        ) : (
          <BarList
            label="Paiements par moyen"
            tone="sales"
            rows={(['cash', 'mobile_money', 'card', 'credit'] as const).map(
              (m) => ({
                key: m,
                name: PAYMENT_LABELS[m],
                value: stats.byMethod[m],
                text: `${money(stats.byMethod[m])} · ${percent(shareBasisPoints(stats.byMethod[m], paid))}`,
              }),
            )}
          />
        )}
      </Card>
    </>
  );
}

/** Money on hand and owed: today, whatever the period. */
function MoneyCard({
  treasury,
  currency,
}: {
  treasury: ApiResult<TreasuryDto>;
  currency: string;
}) {
  return (
    <Card
      title="Trésorerie"
      titleId="treasury-summary"
      icon={Wallet}
      tone="stats"
    >
      {!treasury.ok ? (
        <Alert tone="error">Trésorerie indisponible : {treasury.message}</Alert>
      ) : (
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <KpiTile
              label="Argent disponible"
              value={formatAmount(treasury.data.total, currency)}
              tone="stats"
              icon={Wallet}
            >
              <p className="text-base">
                Caisse, Mobile Money et banque, aujourd’hui
              </p>
            </KpiTile>
            <KpiTile
              label="On vous doit"
              value={formatAmount(
                treasury.data.receivables.customers +
                  treasury.data.receivables.invoices,
                currency,
              )}
              tone="invoices"
              icon={HandCoins}
            >
              <p className="text-base">
                Ventes à crédit et factures non payées
              </p>
            </KpiTile>
          </dl>
          <div>
            <ButtonLink href="/espace/tresorerie" variant="secondary">
              Voir la trésorerie
            </ButtonLink>
          </div>
        </div>
      )}
    </Card>
  );
}

/** Stock at a glance: what is running out, and what the stock is worth. */
function StockCard({
  summary,
  currency,
  canManage,
}: {
  summary: ApiResult<StockSummaryDto>;
  currency: string;
  canManage: boolean;
}) {
  return (
    <Card title="Stock" titleId="stock-summary" icon={Package} tone="stock">
      {!summary.ok ? (
        <Alert tone="error">Stock indisponible : {summary.message}</Alert>
      ) : summary.data.trackedProducts === 0 ? (
        <EmptyState title="Aucun produit suivi pour le moment">
          {canManage ? (
            <Link href="/espace/produits/nouveau" className={LINK}>
              Ajouter votre premier produit
            </Link>
          ) : (
            'Le propriétaire ou un gérant peut ajouter les produits.'
          )}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
            <KpiTile
              label="Produits suivis"
              value={summary.data.trackedProducts}
              tone="stock"
              icon={Package}
            />
            <KpiTile
              label="Épuisés"
              value={summary.data.outOfStock}
              tone="danger"
              icon={PackageX}
            />
            <KpiTile
              label="Bientôt épuisés"
              value={summary.data.lowStock}
              tone="warning"
              icon={TriangleAlert}
            />
            <KpiTile
              label="Valeur du stock"
              value={formatAmount(summary.data.stockValue, currency)}
              tone="accounting"
              icon={Coins}
            >
              <p className="text-base">Au prix d’achat</p>
            </KpiTile>
          </dl>
          {summary.data.unvaluedProducts > 0 && (
            <p className="text-ink-muted">
              {summary.data.unvaluedProducts} produit
              {summary.data.unvaluedProducts > 1 ? 's' : ''} en stock sans prix
              d’achat ne {summary.data.unvaluedProducts > 1 ? 'sont' : 'est'}{' '}
              pas compté{summary.data.unvaluedProducts > 1 ? 's' : ''} dans la
              valeur.
            </p>
          )}
          {summary.data.alerts.length > 0 && (
            <ul
              aria-label="Produits à racheter"
              className="flex flex-col gap-2"
            >
              {summary.data.alerts.map((alert) => (
                <li key={alert.id}>
                  <Link
                    href={`/espace/produits/${alert.id}`}
                    className="flex min-h-12 items-center justify-between gap-3 rounded-xl bg-stock-soft px-3 py-2"
                  >
                    <span className="font-semibold">{alert.name}</span>
                    <Badge tone={STOCK_LEVEL_TONES[alert.stockLevel]}>
                      {alert.stockLevel === 'out'
                        ? STOCK_LEVEL_LABELS.out
                        : `Reste ${formatQuantity(alert.stockQuantity, alert.unit)}`}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href="/espace/produits" className={LINK}>
            Voir tous les produits
          </Link>
        </div>
      )}
    </Card>
  );
}

async function Overview({ searchParams }: PageProps<'/espace'>) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;
  const role = organization.role;
  const currency = organization.defaultCurrency;
  const canReadAudit = roleHasPermission(role, 'audit.read');
  const canReadStats = roleHasPermission(role, 'stats.read');
  // Key figures first; otherwise today's sales come first. « Vendre »
  // floats over the page for those who sell.
  const showFigures = canReadStats;
  const canReadTreasury = roleHasPermission(role, 'treasury.read');
  const canSell = roleHasPermission(role, 'sales.create');

  const period = resolvePeriod(
    await searchParams,
    todayIn(organization.timezone),
    'mois',
  );
  const before = previousPeriod(period.from, period.to);
  const statsOf = (p: { from: string; to: string }) =>
    apiAsUser<StatsSummaryDto>(accessToken, {
      path: `/stats/summary?${new URLSearchParams({ from: p.from, to: p.to })}`,
      organizationId: organization.id,
    });

  const [members, sales, stock, audit, treasury, stats, statsBefore] =
    await Promise.all([
      // Only to name the authors of the recent activity.
      canReadAudit
        ? apiAsUser<MemberDto[]>(accessToken, {
            path: '/organizations/current/members',
            organizationId: organization.id,
          })
        : null,
      apiAsUser<SalesDaySummaryDto>(accessToken, {
        path: '/sales/summary',
        organizationId: organization.id,
      }),
      apiAsUser<StockSummaryDto>(accessToken, {
        path: '/stock/summary',
        organizationId: organization.id,
      }),
      canReadAudit
        ? apiAsUser<Paginated<AuditLogDto>>(accessToken, {
            path: '/audit-logs?limit=5',
            organizationId: organization.id,
          })
        : null,
      canReadTreasury
        ? apiAsUser<TreasuryDto>(accessToken, {
            path: '/treasury',
            organizationId: organization.id,
          })
        : null,
      canReadStats ? statsOf(period) : null,
      canReadStats ? statsOf(before) : null,
    ]);

  const emailById = new Map(
    members?.ok ? members.data.map((m) => [m.userId, m.email]) : [],
  );

  return (
    <>
      <PageHeader
        title={organization.name}
        description={
          showFigures
            ? `Vos chiffres ${range(period.from, period.to)}.`
            : `Boutique créée le ${formatDate(organization.createdAt, organization.timezone)}`
        }
      />

      {stats && statsBefore && (
        <>
          {!stats.ok ? (
            <Alert tone="error">Chiffres indisponibles : {stats.message}</Alert>
          ) : (
            <Essentials
              stats={stats.data}
              before={statsBefore}
              beforeRange={range(before.from, before.to)}
              currency={currency}
            />
          )}
          <PeriodPicker
            path="/espace"
            current={period.key}
            from={period.from}
            to={period.to}
            dates={false}
          />
        </>
      )}

      <TodayCard summary={sales} currency={currency} />

      {stats?.ok && <Details stats={stats.data} currency={currency} />}

      {treasury && <MoneyCard treasury={treasury} currency={currency} />}

      <StockCard
        summary={stock}
        currency={currency}
        canManage={roleHasPermission(role, 'catalog.manage')}
      />

      <Card
        title="Activité récente"
        titleId="recent-activity"
        icon={History}
        tone="brand"
      >
        {!audit ? (
          <p className="text-ink-muted">
            Votre rôle ne donne pas accès à l’historique.
          </p>
        ) : !audit.ok ? (
          <Alert tone="error">Activité indisponible : {audit.message}</Alert>
        ) : audit.data.data.length === 0 ? (
          <EmptyState title="Aucune activité pour le moment" />
        ) : (
          <div className="flex flex-col gap-3">
            <ul className="flex flex-col divide-y divide-line">
              {audit.data.data.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-3 first:pt-0"
                >
                  <span className="font-semibold">
                    {auditActionLabel(entry.action)}
                    {entry.actorId && emailById.has(entry.actorId) && (
                      <span className="font-normal text-ink-muted">
                        {' '}
                        — {emailById.get(entry.actorId)}
                      </span>
                    )}
                  </span>
                  <time
                    dateTime={entry.createdAt}
                    className="text-ink-muted tabular-nums"
                  >
                    {formatDateTime(entry.createdAt, organization.timezone)}
                  </time>
                </li>
              ))}
            </ul>
            <Link href="/espace/journal" className={LINK}>
              Voir tout l’historique
            </Link>
          </div>
        )}
      </Card>

      {canSell && <SellFab />}
    </>
  );
}

export default function OverviewPage(props: PageProps<'/espace'>) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Overview {...props} />
    </Suspense>
  );
}
