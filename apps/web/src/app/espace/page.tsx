import {
  formatAmount,
  roleHasPermission,
  sellsGoods,
  shareBasisPoints,
  showsSection,
  type AuditLogDto,
  type MemberDto,
  type Paginated,
  type MySalesStatsDto,
  type SalesDaySummaryDto,
  type StatsSummaryDto,
  type StockSummaryDto,
  type StockSuggestionDto,
  type CustomerDto,
  type SaleListItemDto,
} from '@nagaw/shared';
import {
  ArrowDownToLine,
  Banknote,
  CheckCheck,
  FileText,
  Plus,
  ShoppingCart,
  type LucideIcon,
  CalendarDays,
  ChartColumn,
  ChevronDown,
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
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense, type ReactNode } from 'react';
import {
  BarList,
  Change,
  KpiTile,
  percent,
  SeeAll,
  SoftStat,
} from '@/components/dashboard/kpi';
import { PeriodMenu } from '@/components/treasury/period-menu';
import { MethodName } from '@/components/sales/method-name';
import { InlineAmount } from '@/components/ui/inline-amount';
import { SalesChart } from '@/components/treasury/sales-chart';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Figure } from '@/components/ui/figure';
import { PageFallback } from '@/components/ui/page-fallback';
import type { ApiResult } from '@/lib/api/call-api';
import { apiAsUser } from '@/lib/api/server';
import {
  formatQuantity,
  STOCK_LEVEL_LABELS,
  STOCK_LEVEL_TONES,
} from '@/lib/catalog/labels';
import { formatCalendarDate, formatDateTime, todayIn } from '@/lib/format';
import { auditActionLabel } from '@/lib/labels';
import { PAYMENT_LABELS, ticketNumber } from '@/lib/sales/labels';
import { ContactAvatar } from '@/components/contacts/contact-actions';
import { HideAmountsButton } from '@/components/ui/hide-amounts';
import { previousPeriod, resolvePeriod } from '@/lib/treasury/period';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { StockSuggestions } from '@/components/catalog/stock-suggestions';

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
 * The answer first (ADR-063): what the shop sold over the period, in large
 * on a dark card that « Masquer » blurs, with what it earned and spent.
 * Every key figure, each compared with the period before, is one touch away
 * under « Tous les chiffres ».
 */
function Essentials({
  stats,
  before,
  beforeRange,
  currency,
  period,
  children,
}: {
  stats: StatsSummaryDto;
  before: ApiResult<StatsSummaryDto>;
  beforeRange: string;
  currency: string;
  /** The period, as a pill that opens the others. */
  period: ReactNode;
  /** Shown right under the profit: the money and what to do today. */
  children?: ReactNode;
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
      <div className="flex flex-col gap-4 rounded-[2rem] bg-ink p-5 text-canvas md:p-7">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {period}
            <p className="text-base font-bold text-[#c9c5ff]">
              {stats.salesCount} vente{stats.salesCount > 1 ? 's' : ''}
            </p>
          </div>
          <HideAmountsButton compact />
        </div>
        <dl className="grid grid-cols-2 gap-x-2 gap-y-3">
          <div className="@container col-span-2 flex min-w-0 flex-col">
            <dt className="sr-only">Chiffre d’affaires</dt>
            <dd className="montant-prive font-extrabold tracking-tight tabular-nums">
              <Figure
                value={money(stats.revenue)}
                className="[--figure-max:2.25rem]"
              />
            </dd>
          </div>
          <div className="@container flex min-w-0 flex-col gap-0.5 rounded-2xl bg-white/10 p-3">
            <dt className="text-base text-[#9be7c4]">
              {profit(stats) < 0 ? 'Vous avez perdu' : 'Vous avez gagné'}
            </dt>
            <dd className="montant-prive font-extrabold tabular-nums">
              <Figure
                value={money(Math.abs(profit(stats)))}
                className="[--figure-max:1.25rem]"
              />
            </dd>
          </div>
          <div className="@container flex min-w-0 flex-col gap-0.5 rounded-2xl bg-white/10 p-3">
            <dt className="text-base">Dépenses</dt>
            <dd className="montant-prive font-extrabold tabular-nums">
              <Figure
                value={money(stats.expenses)}
                className="[--figure-max:1.25rem]"
              />
            </dd>
          </div>
        </dl>
      </div>
      {children}
      <details className="group rounded-3xl bg-surface">
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 rounded-2xl px-4 text-lg font-bold md:px-6 [&::-webkit-details-marker]:hidden">
          <span className="flex-1">Tous les chiffres</span>
          <ChevronDown
            aria-hidden
            className="size-6 shrink-0 text-ink-muted transition-transform group-open:rotate-180 motion-reduce:transition-none"
          />
        </summary>
        <div className="flex flex-col gap-2 px-3 pb-3 md:px-6 md:pb-6">
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
        </div>
      </details>
    </section>
  );
}

/** What sells best over the period, and what is in stock but never sells. */
function Products({
  stats,
  currency,
  countsStock,
  showsReports,
}: {
  stats: StatsSummaryDto;
  currency: string;
  countsStock: boolean;
  /** Reports hidden by the shop (ADR-067): no link to them. */
  showsReports: boolean;
}) {
  const money = (value: number) => formatAmount(value, currency);
  return (
    <>
      <Card
        title="Ce qui rapporte le plus"
        titleId="top-products"
        icon={Trophy}
        tone="stats"
        action={
          showsReports && (
            <SeeAll href="/espace/statistiques" what="statistiques" />
          )
        }
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
                  // Secondary link: the product page is not prefetched on a first
                  // visit (weight budget, Phase 17).
                  prefetch={false}
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
                    // Secondary link: the product page is not prefetched on a first
                    // visit (weight budget, Phase 17).
                    prefetch={false}
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
              name: <MethodName method={m} />,
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

interface Shortcut {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Background and colour of its round icon. */
  tone: string;
}

/**
 * The gestures of every day in round buttons (ADR-063), for who may do
 * them: a shop without the right sees fewer, never a dead button.
 */
function Shortcuts({ items }: { items: Shortcut[] }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Raccourcis">
      <ul className="grid grid-cols-4 gap-2 md:max-w-xl">
        {items.map(({ href, label, icon: Icon, tone }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex flex-col items-center gap-2 rounded-2xl py-1 text-center text-base leading-tight font-bold"
            >
              <span
                className={`flex size-15 items-center justify-center rounded-full ${tone}`}
              >
                <Icon aria-hidden className="size-6" />
              </span>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Who owes the shop, as round faces: one touch opens their thread. */
function Debtors({
  customers,
  currency,
}: {
  customers: ApiResult<CustomerDto[]>;
  currency: string;
}) {
  if (!customers.ok)
    return (
      <Alert tone="error">Crédit indisponible : {customers.message}</Alert>
    );
  const owing = customers.data
    .filter((c) => c.balance > 0)
    .sort((a, b) => b.balance - a.balance);
  if (owing.length === 0) return null;
  const total = owing.reduce((sum, c) => sum + c.balance, 0);
  return (
    <section aria-labelledby="debtors" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3">
        <h2 id="debtors" className="text-lg font-extrabold">
          Ils vous doivent ·{' '}
          <span className="montant-prive text-warning-ink">
            {formatAmount(total, currency)}
          </span>
        </h2>
        <Link
          href="/espace/clients?doivent=1"
          className="inline-flex min-h-12 items-center font-bold text-brand-ink"
        >
          Tout voir
        </Link>
      </div>
      <ul className="flex gap-3 overflow-x-auto pb-1">
        {owing.slice(0, 8).map((c) => (
          <li key={c.id} className="w-20 shrink-0">
            <Link
              href={`/espace/clients/${c.id}`}
              className="flex flex-col items-center gap-1 text-center"
            >
              <span className="rounded-full p-0.5 ring-2 ring-warning">
                <ContactAvatar person={c} size="size-14 text-lg" />
              </span>
              <span className="w-full truncate text-base font-bold">
                {c.name.split(' ')[0]}
              </span>
              <InlineAmount
                minor={c.balance}
                currency={currency}
                fit="box"
                className="montant-prive text-base font-extrabold text-warning-ink"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The last sales, like the history of a mobile money application. */
function RecentSales({
  sales,
  currency,
  timezone,
}: {
  sales: ApiResult<SaleListItemDto[]>;
  currency: string;
  timezone: string;
}) {
  return (
    <section aria-labelledby="recent" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3">
        <h2 id="recent" className="text-lg font-extrabold">
          Dernières ventes
        </h2>
        <Link
          href="/espace/ventes"
          className="inline-flex min-h-12 items-center font-bold text-brand-ink"
        >
          Voir les ventes
        </Link>
      </div>
      {!sales.ok ? (
        <Alert tone="error">Ventes indisponibles : {sales.message}</Alert>
      ) : sales.data.length === 0 ? (
        <p className="rounded-3xl bg-surface px-4 py-5 text-ink-muted">
          Pas encore de vente. Touchez « Caisse » pour commencer.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-3xl bg-surface px-4">
          {sales.data.slice(0, 4).map((sale) => {
            const cancelled = sale.status === 'cancelled';
            return (
              <li key={sale.id}>
                <Link
                  href={`/espace/ventes/${sale.id}`}
                  className="flex min-h-16 items-center gap-3 py-2"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-canvas text-sales-ink">
                    <ShoppingCart aria-hidden className="size-5" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-bold">
                      Ticket {ticketNumber(sale.saleNumber)}
                    </span>
                    <span className="truncate text-sm text-ink-muted">
                      {sale.methods.map((m) => PAYMENT_LABELS[m]).join(', ')}
                      {' · '}
                      {formatDateTime(sale.occurredAt, timezone)}
                    </span>
                  </span>
                  <InlineAmount
                    minor={sale.total}
                    currency={currency}
                    className={`montant-prive font-extrabold ${
                      cancelled
                        ? 'text-ink-muted line-through'
                        : 'text-sales-ink'
                    }`}
                  />
                  {/* On the server: sent (two ticks, ADR-063). */}
                  {cancelled ? (
                    <span className="text-base font-bold text-danger-ink">
                      Annulée
                    </span>
                  ) : (
                    <CheckCheck
                      role="img"
                      aria-label="Enregistrée"
                      className="size-5 shrink-0 text-sales-ink"
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
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
                    // Secondary link: the product page is not prefetched on a first
                    // visit (weight budget, Phase 17).
                    prefetch={false}
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
  // The profit first; otherwise today's sales come first. « Vendre » is in
  // the bottom bar on a phone and floats over the page on a computer.
  const canReadStats = roleHasPermission(role, 'stats.read');
  const canSell = roleHasPermission(role, 'sales.create');
  // What the shop shows (ADR-067): a hidden part has no shortcut nor card.
  const shows = (section: Parameters<typeof showsSection>[1]) =>
    showsSection(organization, section);

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
  const canReadCustomers = roleHasPermission(role, 'customers.read');
  const [
    members,
    sales,
    stock,
    audit,
    stats,
    statsBefore,
    mine,
    debtors,
    recent,
    suggestions,
  ] = await Promise.all([
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
    canReadStats ? statsOf(period) : null,
    canReadStats ? statsOf(before) : null,
    showMine
      ? apiAsUser<MySalesStatsDto>(accessToken, {
          path: '/sales/my-stats',
          organizationId: organization.id,
        })
      : null,
    canReadCustomers && shows('credit')
      ? apiAsUser<CustomerDto[]>(accessToken, {
          path: '/customers?owing=true',
          organizationId: organization.id,
        })
      : null,
    apiAsUser<SaleListItemDto[]>(accessToken, {
      path: `/sales?${new URLSearchParams({ all: 'true', limit: '4', offset: '0' })}`,
      organizationId: organization.id,
    }),
    // Products sold often, not counted (ADR-070): for who can count them.
    sellsGoods(organization.offer) && roleHasPermission(role, 'catalog.manage')
      ? apiAsUser<StockSuggestionDto[]>(accessToken, {
          path: '/stock/suggestions',
          organizationId: organization.id,
        })
      : null,
  ]);

  // Stock is shown where something is counted: by default, or one product.
  const countsStock =
    sellsGoods(organization.offer) &&
    (organization.countsStockByDefault ||
      (stock.ok && stock.data.trackedProducts > 0));

  const shortcuts: Shortcut[] = [
    ...(roleHasPermission(role, 'customers.manage') && shows('credit')
      ? [
          {
            href: '/espace/clients?doivent=1',
            label: 'Encaisser un crédit',
            icon: HandCoins,
            tone: 'bg-warning-soft text-warning-ink',
          },
        ]
      : []),
    ...(roleHasPermission(role, 'treasury.manage') && shows('expenses')
      ? [
          {
            href: '/espace/tresorerie/depenses/nouvelle',
            label: 'Dépense',
            icon: ArrowDownToLine,
            tone: 'bg-stats-soft text-stats-ink',
          },
        ]
      : []),
    ...(roleHasPermission(role, 'catalog.manage')
      ? [
          {
            href: '/espace/produits/nouveau',
            label: 'Produit',
            icon: Plus,
            tone: 'bg-stock-soft text-stock-ink',
          },
        ]
      : []),
    ...(roleHasPermission(role, 'documents.read') && shows('documents')
      ? [
          {
            href: '/espace/factures',
            label: 'Facture / devis',
            icon: FileText,
            tone: 'bg-brand-soft text-brand-ink',
          },
        ]
      : []),
  ];
  const today = (
    <>
      <Shortcuts items={shortcuts} />
      {debtors && <Debtors customers={debtors} currency={currency} />}
      <RecentSales
        sales={recent}
        currency={currency}
        timezone={organization.timezone}
      />
    </>
  );

  const emailById = new Map(
    members?.ok ? members.data.map((m) => [m.userId, m.email]) : [],
  );
  // Who sees the dark card has the day in it; the band is for the others.
  const showToday = !stats?.ok;

  return (
    <>
      {/* The shop's name is in the top bar: no title to repeat it. */}
      <h1 className="sr-only">{organization.name}</h1>

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
              period={<PeriodMenu path="/espace" current={period.key} />}
            >
              {today}
            </Essentials>
          )}
        </>
      )}

      {!stats?.ok && today}

      {showToday && <TodayCard summary={sales} currency={currency} />}

      {mine && <MyFiguresCard figures={mine} currency={currency} />}

      {suggestions && !suggestions.ok && (
        <Alert tone="error">
          Suggestions de stock indisponibles : {suggestions.message}
        </Alert>
      )}
      {suggestions?.ok && suggestions.data.length > 0 && (
        <StockSuggestions
          organizationId={organization.id}
          suggestions={suggestions.data}
        />
      )}

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

      {stats?.ok && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Products
            stats={stats.data}
            currency={currency}
            countsStock={countsStock}
            showsReports={shows('reports')}
          />
          <PaymentsCard stats={stats.data} currency={currency} />
        </div>
      )}

      {audit && (
        <ActivityCard
          audit={audit}
          emailById={emailById}
          timezone={organization.timezone}
        />
      )}
    </>
  );
}

export default function OverviewPage(props: PageProps<'/espace'>) {
  return (
    <Suspense fallback={<PageFallback variant="dashboard" />}>
      <Overview {...props} />
    </Suspense>
  );
}
