import {
  formatAmount,
  roleHasPermission,
  sellsGoods,
  shareBasisPoints,
  showsModule,
  type AuditLogDto,
  type MemberDto,
  type Paginated,
  type MySalesStatsDto,
  type SalesDaySummaryDto,
  type StatsSummaryDto,
  type StockSummaryDto,
  type TreasuryDto,
} from '@nagaw/shared';
import {
  Banknote,
  CalendarDays,
  ChartColumn,
  ChevronRight,
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
import {
  BarList,
  Change,
  KpiTile,
  percent,
  SeeAll,
  SoftStat,
} from '@/components/dashboard/kpi';
import { ProfilePrompt } from '@/components/dashboard/profile-prompt';
import { SellFab } from '@/components/dashboard/sell-fab';
import { PeriodPicker } from '@/components/treasury/period-picker';
import { SalesChart } from '@/components/treasury/sales-chart';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Figure } from '@/components/ui/figure';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import type { ApiResult } from '@/lib/api/call-api';
import { apiAsUser } from '@/lib/api/server';
import {
  formatQuantity,
  STOCK_LEVEL_LABELS,
  STOCK_LEVEL_TONES,
} from '@/lib/catalog/labels';
import { formatCalendarDate, formatDateTime, todayIn } from '@/lib/format';
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

const capitalize = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);

/** Today's sales, whatever the period of the figures: one green band. */
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
      className="flex flex-col gap-2 rounded-2xl border border-sales/30 bg-sales-soft px-4 py-3 shadow-sm md:flex-row md:items-center md:gap-6 md:px-6"
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id="today"
          className="flex items-center gap-2 text-lg font-extrabold text-sales-ink"
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-sales-strong text-white">
            <CalendarDays aria-hidden className="size-5" />
          </span>
          Aujourd’hui
        </h2>
        <Link
          href="/espace/ventes"
          className="inline-flex min-h-12 items-center gap-1 font-bold text-sales-ink underline underline-offset-4 md:hidden"
        >
          Voir les ventes
          <ChevronRight aria-hidden className="size-5" />
        </Link>
      </div>
      {!summary.ok ? (
        <Alert tone="error">Ventes indisponibles : {summary.message}</Alert>
      ) : (
        <dl className="grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)] gap-x-6">
          <div>
            <dt className="text-base">Ventes</dt>
            <dd className="text-2xl font-extrabold tabular-nums">
              {summary.data.count}
            </dd>
          </div>
          <div className="@container min-w-0">
            <dt className="text-base">Montant</dt>
            <dd className="font-extrabold tabular-nums">
              <Figure
                value={formatAmount(summary.data.total, currency)}
                className="[--figure-max:1.5rem]"
              />
            </dd>
          </div>
        </dl>
      )}
      <Link
        href="/espace/ventes"
        className="hidden min-h-12 items-center gap-1 font-bold text-sales-ink underline underline-offset-4 md:inline-flex"
      >
        Voir les ventes
        <ChevronRight aria-hidden className="size-5" />
      </Link>
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
    <section aria-labelledby="essentials" className="flex flex-col gap-2">
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
          <p className="text-base">Marge − dépenses</p>
          {change(profit)}
        </KpiTile>
      </dl>
      <p className="text-ink-muted">
        {before.ok
          ? `Comparé à la période d’avant (${beforeRange}).`
          : `Comparaison indisponible : ${before.message}`}
      </p>
      {stats.revenue > 0 && stats.margin.coverageBasisPoints < 10000 && (
        <p className="text-ink-muted">
          Marge sur {percent(stats.margin.coverageBasisPoints)} des ventes :{' '}
          <Link
            href="/espace/produits"
            className="font-semibold text-brand-ink underline"
          >
            ajoutez les prix d’achat
          </Link>
          .
        </p>
      )}
    </section>
  );
}

/** What sells best over the period, and what is in stock but never sells. */
function Products({
  stats,
  currency,
  countsStock,
}: {
  stats: StatsSummaryDto;
  currency: string;
  countsStock: boolean;
}) {
  const money = (value: number) => formatAmount(value, currency);
  return (
    <>
      <Card
        title="Ce qui rapporte le plus"
        titleId="top-products"
        icon={Trophy}
        tone="stats"
        action={<SeeAll href="/espace/statistiques" what="statistiques" />}
      >
        {stats.topProducts.length === 0 ? (
          <EmptyState title="Aucune vente sur cette période" />
        ) : (
          <BarList
            label="Ce qui rapporte le plus"
            tone="stats"
            rows={stats.topProducts.slice(0, 5).map((p) => ({
              key: p.productId,
              name: (
                <Link
                  href={`/espace/produits/${p.productId}`}
                  className="underline-offset-4 hover:underline"
                >
                  {p.label}
                  <span className="font-normal text-ink-muted">
                    {' '}
                    · {formatQuantity(p.quantity, p.unit)}
                  </span>
                </Link>
              ),
              value: p.revenue,
              text: money(p.revenue),
            }))}
          />
        )}
      </Card>

      {countsStock && (
        <Card
          title="Ne se vendent pas"
          titleId="slow-products"
          icon={PackageX}
          tone="stock"
        >
          {stats.slowProducts.length === 0 ? (
            <EmptyState title="Tout ce qui est en stock s’est vendu" />
          ) : (
            <ul
              aria-labelledby="slow-products"
              className="flex flex-col divide-y divide-line"
            >
              {stats.slowProducts.slice(0, 5).map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-x-3"
                >
                  <Link
                    href={`/espace/produits/${p.id}`}
                    className="inline-flex min-h-12 items-center font-semibold underline-offset-4 hover:underline"
                  >
                    {p.name}
                  </Link>
                  <span className="text-ink-muted tabular-nums">
                    Reste {formatQuantity(p.stockQuantity, p.unit)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </>
  );
}

/** How the period was paid: cash, Mobile Money, card, credit. */
function PaymentsCard({
  stats,
  currency,
}: {
  stats: StatsSummaryDto;
  currency: string;
}) {
  const paid = Object.values(stats.byMethod).reduce((t, v) => t + v, 0);
  return (
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
              text: `${formatAmount(stats.byMethod[m], currency)} · ${percent(shareBasisPoints(stats.byMethod[m], paid))}`,
            }),
          )}
        />
      )}
    </Card>
  );
}

/**
 * A seller's own figures (ADR-036): their sales today and over 7 days,
 * and what they sell best. Never the shop's totals.
 */
function MyFiguresCard({
  figures,
  currency,
}: {
  figures: ApiResult<MySalesStatsDto>;
  currency: string;
}) {
  const money = (value: number) => formatAmount(value, currency);
  const sales = (count: number) => `${count} vente${count > 1 ? 's' : ''}`;
  return (
    <Card title="Mes ventes" titleId="my-figures" icon={Trophy} tone="sales">
      {!figures.ok ? (
        <Alert tone="error">
          Vos chiffres sont indisponibles : {figures.message}
        </Alert>
      ) : (
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-2 sm:gap-3">
            <KpiTile
              label="Aujourd’hui"
              value={money(figures.data.today.total)}
              tone="sales"
              icon={Receipt}
            >
              <p className="text-base">{sales(figures.data.today.count)}</p>
            </KpiTile>
            <KpiTile
              label="7 derniers jours"
              value={money(figures.data.week.total)}
              tone="stats"
              icon={ChartColumn}
            >
              <p className="text-base">{sales(figures.data.week.count)}</p>
            </KpiTile>
          </dl>
          {figures.data.topProducts.length > 0 && (
            <BarList
              label="Ce que je vends le plus (7 jours)"
              tone="sales"
              rows={figures.data.topProducts.map((p) => ({
                key: p.productId,
                name: p.label,
                value: p.total,
                text: money(p.total),
              }))}
            />
          )}
        </div>
      )}
    </Card>
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
      action={<SeeAll href="/espace/tresorerie" what="trésorerie" />}
    >
      {!treasury.ok ? (
        <Alert tone="error">Trésorerie indisponible : {treasury.message}</Alert>
      ) : (
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
          <SoftStat
            label="Argent disponible"
            value={formatAmount(treasury.data.total, currency)}
            tone="stats"
            icon={Wallet}
            hint="Caisse, Mobile Money, banque"
          />
          <SoftStat
            label="On vous doit"
            value={formatAmount(
              treasury.data.receivables.customers +
                treasury.data.receivables.invoices,
              currency,
            )}
            tone="invoices"
            icon={HandCoins}
            hint="Crédits et factures"
          />
        </dl>
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
  const unvalued = summary.ok ? summary.data.unvaluedProducts : 0;
  return (
    <Card
      title="Stock"
      titleId="stock-summary"
      icon={Package}
      tone="stock"
      action={
        summary.ok &&
        summary.data.trackedProducts > 0 && (
          <SeeAll href="/espace/produits" what="produits et services" />
        )
      }
    >
      {!summary.ok ? (
        <Alert tone="error">Stock indisponible : {summary.message}</Alert>
      ) : summary.data.trackedProducts === 0 ? (
        <EmptyState title="Aucun stock suivi pour le moment">
          {canManage ? (
            <Link href="/espace/produits/nouveau" className={LINK}>
              Ajouter un produit ou un service
            </Link>
          ) : (
            'Le propriétaire ou un gérant peut ajouter ce que la boutique vend.'
          )}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          <dl className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
            <SoftStat
              label="Épuisés"
              value={summary.data.outOfStock}
              tone="danger"
              icon={PackageX}
            />
            <SoftStat
              label="Bientôt épuisés"
              value={summary.data.lowStock}
              tone="warning"
              icon={TriangleAlert}
            />
            <SoftStat
              label="Valeur du stock"
              value={formatAmount(summary.data.stockValue, currency)}
              tone="accounting"
              icon={Coins}
              hint={
                unvalued > 0
                  ? `Au prix d’achat, ${unvalued} produit${unvalued > 1 ? 's' : ''} sans prix`
                  : 'Au prix d’achat'
              }
            />
          </dl>
          {summary.data.alerts.length > 0 && (
            <ul
              aria-label="Produits à racheter"
              className="flex flex-col gap-2"
            >
              {summary.data.alerts.map((alert) => (
                <li key={alert.id}>
                  <Link
                    href={`/espace/produits/${alert.id}`}
                    className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-line px-3 py-2 hover:bg-surface-muted"
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
        </div>
      )}
    </Card>
  );
}

/** The last five actions in the shop, for those who may read the history. */
function ActivityCard({
  audit,
  emailById,
  timezone,
}: {
  audit: ApiResult<Paginated<AuditLogDto>>;
  emailById: Map<string, string>;
  timezone: string;
}) {
  return (
    <Card
      title="Activité récente"
      titleId="recent-activity"
      icon={History}
      tone="brand"
      action={<SeeAll href="/espace/journal" what="historique" />}
    >
      {!audit.ok ? (
        <Alert tone="error">Activité indisponible : {audit.message}</Alert>
      ) : audit.data.data.length === 0 ? (
        <EmptyState title="Aucune activité pour le moment" />
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {audit.data.data.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-wrap justify-between gap-x-4 py-2 first:pt-0"
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
                {formatDateTime(entry.createdAt, timezone)}
              </time>
            </li>
          ))}
        </ul>
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
  // Key figures first; otherwise today's sales come first. « Vendre »
  // floats over the page for those who sell.
  const canReadStats = roleHasPermission(role, 'stats.read');
  // A shop that hides its statistics gets a plain dashboard (ADR-062).
  const showsStats =
    canReadStats && showsModule(organization.hiddenModules, 'stats');
  const canReadTreasury = roleHasPermission(role, 'treasury.read');
  const canSell = roleHasPermission(role, 'sales.create');
  const countsStock = sellsGoods(organization.offer);

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

  // Sellers see their own figures, not the shop's.
  const showMine = canSell && !canReadStats;
  const [members, sales, stock, audit, treasury, stats, statsBefore, mine] =
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
      showsStats ? statsOf(period) : null,
      showsStats ? statsOf(before) : null,
      showMine
        ? apiAsUser<MySalesStatsDto>(accessToken, {
            path: '/sales/my-stats',
            organizationId: organization.id,
          })
        : null,
    ]);

  const emailById = new Map(
    members?.ok ? members.data.map((m) => [m.userId, m.email]) : [],
  );
  // With the figures of today on screen, the band would repeat them.
  const showToday = !(stats?.ok && period.key === 'jour');

  return (
    <>
      <PageHeader
        title={organization.name}
        description={
          stats ? capitalize(range(period.from, period.to)) : undefined
        }
      />

      {organization.profileStatus === 'pending' &&
        roleHasPermission(role, 'organization.update') && (
          <ProfilePrompt organizationId={organization.id} />
        )}

      {stats && statsBefore && (
        <>
          <PeriodPicker
            path="/espace"
            current={period.key}
            from={period.from}
            to={period.to}
            dates={false}
          />
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
        </>
      )}

      {showToday && <TodayCard summary={sales} currency={currency} />}

      {mine && <MyFiguresCard figures={mine} currency={currency} />}

      {countsStock && (
        <StockCard
          summary={stock}
          currency={currency}
          canManage={roleHasPermission(role, 'catalog.manage')}
        />
      )}

      {stats?.ok && (
        <Card>
          <SalesChart days={stats.data.days} currency={currency} />
        </Card>
      )}

      {(stats?.ok || treasury) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {stats?.ok && (
            <>
              <Products
                stats={stats.data}
                currency={currency}
                countsStock={countsStock}
              />
              <PaymentsCard stats={stats.data} currency={currency} />
            </>
          )}
          {treasury && <MoneyCard treasury={treasury} currency={currency} />}
        </div>
      )}

      {audit && (
        <ActivityCard
          audit={audit}
          emailById={emailById}
          timezone={organization.timezone}
        />
      )}

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
