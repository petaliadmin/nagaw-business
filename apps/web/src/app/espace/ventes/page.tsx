import {
  formatAmount,
  PAYMENT_METHODS,
  type PaymentMethod,
  roleHasPermission,
  type SaleListItemDto,
  type SalesDaySummaryDto,
} from '@nagaw/shared';
import {
  Banknote,
  CalendarDays,
  ChevronRight,
  CreditCard,
  HandCoins,
  Receipt,
  Smartphone,
  type LucideIcon,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { SoftStat } from '@/components/dashboard/kpi';
import { SellFab } from '@/components/dashboard/sell-fab';
import type { ModuleTone } from '@/components/dashboard/tones';
import { CONTROL } from '@/components/form-field';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { buttonClasses } from '@/components/ui/button-styles';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Figure } from '@/components/ui/figure';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { apiAsUser } from '@/lib/api/server';
import {
  formatCalendarDate,
  formatContact,
  formatDateTime,
  todayIn,
} from '@/lib/format';
import { pageNumber, pageParams, pageRows } from '@/lib/pagination';
import { PAYMENT_LABELS } from '@/lib/sales/labels';
import { ticketLabel } from '@/lib/sales/ticket';
import { requireReadyWorkspace } from '@/lib/workspace/load';

export const metadata: Metadata = { title: 'Ventes — Nagaw Business' };

/** How each means of payment shows in the day's summary. */
const PAYMENT_ICONS: Record<PaymentMethod, LucideIcon> = {
  cash: Banknote,
  mobile_money: Smartphone,
  card: CreditCard,
  credit: HandCoins,
};
const PAYMENT_TONES: Record<PaymentMethod, ModuleTone> = {
  cash: 'sales',
  mobile_money: 'stats',
  card: 'stock',
  credit: 'invoices',
};

/** The day before a calendar date (YYYY-MM-DD). */
function previousDay(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

async function Sales({ searchParams }: PageProps<'/espace/ventes'>) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;
  const currency = organization.defaultCurrency;
  const money = (value: number) => formatAmount(value, currency);
  const today = todayIn(organization.timezone);
  const raw = await searchParams;
  const requested = raw.jour;
  const everyDay = raw.vue === 'toutes';
  const page = pageNumber(raw.page);
  const day =
    typeof requested === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(requested)
      ? requested
      : today;
  const allSales = roleHasPermission(organization.role, 'sales.read_all');

  const [sales, summary] = await Promise.all([
    apiAsUser<SaleListItemDto[]>(accessToken, {
      path: `/sales?${new URLSearchParams({
        ...(everyDay ? { all: 'true' } : { day }),
        ...pageParams(page),
      })}`,
      organizationId: organization.id,
    }),
    apiAsUser<SalesDaySummaryDto>(accessToken, {
      path: `/sales/summary?day=${day}`,
      organizationId: organization.id,
    }),
  ]);
  const list = sales.ok ? pageRows(sales.data) : null;
  const listParams = new URLSearchParams();
  if (everyDay) listParams.set('vue', 'toutes');
  else if (day !== today) listParams.set('jour', day);
  const dayLabel =
    day === today
      ? 'Aujourd’hui'
      : day === previousDay(today)
        ? 'Hier'
        : formatCalendarDate(day);

  const isToday = !everyDay && day === today;
  const isYesterday = !everyDay && day === previousDay(today);
  const isOther = !everyDay && !isToday && !isYesterday;
  const chip = (current: boolean) =>
    buttonClasses(current ? 'primary' : 'secondary', 'shrink-0');

  return (
    <>
      <PageHeader
        title="Ventes"
        description={allSales ? undefined : 'Vos ventes.'}
      />

      <div className="flex flex-wrap items-start gap-2">
        <nav aria-label="Choisir le jour" className="flex flex-wrap gap-2">
          <Link
            href="/espace/ventes"
            aria-current={isToday ? 'true' : undefined}
            className={chip(isToday)}
          >
            Aujourd’hui
          </Link>
          <Link
            href={`/espace/ventes?jour=${previousDay(today)}`}
            aria-current={isYesterday ? 'true' : undefined}
            className={chip(isYesterday)}
          >
            Hier
          </Link>
          <Link
            href="/espace/ventes?vue=toutes"
            aria-current={everyDay ? 'true' : undefined}
            className={chip(everyDay)}
          >
            Toutes
          </Link>
        </nav>
        <details open={isOther || undefined} className="open:basis-full">
          <summary
            className={`${chip(isOther)} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
          >
            <CalendarDays aria-hidden className="size-5" />
            Autre jour
          </summary>
          <form action="/espace/ventes" className="mt-3 flex items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="sales-day" className="font-semibold">
                Jour
              </label>
              <input
                id="sales-day"
                name="jour"
                type="date"
                defaultValue={day}
                max={today}
                className={CONTROL}
              />
            </div>
            <button type="submit" className={buttonClasses('secondary')}>
              Voir
            </button>
          </form>
        </details>
      </div>

      {/* A day has its totals; the whole history is only a list. */}
      {everyDay ? null : !summary.ok ? (
        <Alert tone="error">Résumé indisponible : {summary.message}</Alert>
      ) : (
        <Card
          title={dayLabel}
          titleId="day-summary"
          icon={CalendarDays}
          tone="sales"
        >
          <dl className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
            {/* The total first, on its own line on a phone: the largest
                figure of the screen (DESIGN.md). */}
            <div className="@container col-span-2 flex min-w-0 flex-col gap-1 rounded-xl bg-sales-soft p-4">
              <dt className="flex items-center gap-2 font-bold text-sales-ink">
                <Banknote aria-hidden className="size-5 shrink-0" />
                Total
              </dt>
              <dd className="flex flex-col gap-0.5">
                <Figure
                  value={money(summary.data.total)}
                  className="font-extrabold text-ink tabular-nums [--figure-max:2.25rem]"
                />
                <p className="text-ink-muted">Encaissé et à crédit</p>
              </dd>
            </div>
            <SoftStat
              label="Ventes"
              value={summary.data.count}
              tone="sales"
              icon={Receipt}
            />
            {PAYMENT_METHODS.filter((m) => summary.data.byMethod[m] > 0).map(
              (m) => (
                <SoftStat
                  key={m}
                  label={PAYMENT_LABELS[m]}
                  value={money(summary.data.byMethod[m])}
                  tone={PAYMENT_TONES[m]}
                  icon={PAYMENT_ICONS[m]}
                />
              ),
            )}
          </dl>
        </Card>
      )}

      {!sales.ok ? (
        <Alert tone="error">Ventes indisponibles : {sales.message}</Alert>
      ) : !list || list.rows.length === 0 ? (
        <EmptyState
          title={
            everyDay ? 'Aucune vente pour le moment' : 'Aucune vente ce jour-là'
          }
        />
      ) : (
        <ul aria-label="Liste des ventes" className="flex flex-col gap-2">
          {list.rows.map((sale) => (
            <li key={sale.id}>
              <Link
                href={`/espace/ventes/${sale.id}`}
                className="flex min-h-16 items-center gap-3 rounded-2xl border border-line bg-surface px-3 py-3 shadow-sm transition-colors hover:bg-surface-muted sm:px-4"
              >
                <span
                  className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
                    sale.status === 'cancelled'
                      ? 'bg-surface-muted text-ink-muted'
                      : 'bg-sales-soft text-sales-ink'
                  }`}
                >
                  <Receipt aria-hidden className="size-5" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-bold break-words">
                    Ticket {ticketLabel(sale)}
                    {sale.customerName ? ` — ${sale.customerName}` : ''}
                  </span>
                  <span className="break-words text-ink-muted">
                    {everyDay
                      ? formatDateTime(sale.occurredAt, organization.timezone)
                      : new Intl.DateTimeFormat('fr', {
                          timeStyle: 'short',
                          timeZone: organization.timezone,
                        }).format(new Date(sale.occurredAt))}{' '}
                    · {sale.itemCount} article{sale.itemCount > 1 ? 's' : ''} ·{' '}
                    {sale.methods.map((m) => PAYMENT_LABELS[m]).join(', ')}
                    {allSales ? ` · ${formatContact(sale.sellerEmail)}` : ''}
                  </span>
                  {(sale.priceReview ||
                    sale.stockReview ||
                    sale.status === 'cancelled') && (
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      {sale.priceReview && (
                        <Badge tone="warning">Prix à vérifier</Badge>
                      )}
                      {sale.stockReview && (
                        <Badge tone="warning">Stock à vérifier</Badge>
                      )}
                      {sale.status === 'cancelled' && (
                        <Badge tone="danger">Annulée</Badge>
                      )}
                    </span>
                  )}
                </span>
                <span
                  className={`shrink-0 text-lg font-extrabold tabular-nums ${sale.status === 'cancelled' ? 'text-ink-muted line-through' : 'text-ink'}`}
                >
                  {money(sale.total)}
                </span>
                <ChevronRight
                  aria-hidden
                  className="hidden size-5 shrink-0 text-ink-muted sm:block"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pagination
        path="/espace/ventes"
        params={listParams}
        page={page}
        hasNext={list?.hasNext ?? false}
      />

      {roleHasPermission(organization.role, 'sales.create') && <SellFab />}
    </>
  );
}

export default function SalesPage(props: PageProps<'/espace/ventes'>) {
  return (
    <Suspense fallback={<PageFallback variant="list" />}>
      <Sales {...props} />
    </Suspense>
  );
}
