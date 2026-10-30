import {
  formatAmount,
  PAYMENT_METHODS,
  roleHasPermission,
  type SaleListItemDto,
  type SalesDaySummaryDto,
} from '@nagaw/shared';
import { CalendarDays } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { SellFab } from '@/components/dashboard/sell-fab';
import { CONTROL } from '@/components/form-field';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { buttonClasses } from '@/components/ui/button-styles';
import { Card, Stat } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { apiAsUser } from '@/lib/api/server';
import { formatCalendarDate, formatDateTime, todayIn } from '@/lib/format';
import { pageNumber, pageParams, pageRows } from '@/lib/pagination';
import { PAYMENT_LABELS } from '@/lib/sales/labels';
import { ticketLabel } from '@/lib/sales/ticket';
import { requireReadyWorkspace } from '@/lib/workspace/load';

export const metadata: Metadata = { title: 'Ventes — Nagaw Business' };

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

  return (
    <>
      <PageHeader
        title="Ventes"
        description={allSales ? 'Les ventes de la boutique.' : 'Vos ventes.'}
      />

      <nav
        aria-label="Choisir le jour"
        className="flex flex-wrap items-end gap-2"
      >
        <Link
          href="/espace/ventes"
          aria-current={!everyDay && day === today ? 'true' : undefined}
          className={buttonClasses(
            !everyDay && day === today ? 'primary' : 'secondary',
          )}
        >
          Aujourd’hui
        </Link>
        <Link
          href={`/espace/ventes?jour=${previousDay(today)}`}
          aria-current={
            !everyDay && day === previousDay(today) ? 'true' : undefined
          }
          className={buttonClasses(
            !everyDay && day === previousDay(today) ? 'primary' : 'secondary',
          )}
        >
          Hier
        </Link>
        <Link
          href="/espace/ventes?vue=toutes"
          aria-current={everyDay ? 'true' : undefined}
          className={buttonClasses(everyDay ? 'primary' : 'secondary')}
        >
          Toutes
        </Link>
      </nav>
      <details
        open={
          (!everyDay && day !== today && day !== previousDay(today)) ||
          undefined
        }
      >
        <summary className="inline-flex min-h-12 cursor-pointer list-none items-center gap-2 font-semibold text-brand-ink underline underline-offset-4 [&::-webkit-details-marker]:hidden">
          <CalendarDays aria-hidden className="size-5" />
          Voir un autre jour
        </summary>
        <form action="/espace/ventes" className="mt-2 flex items-end gap-2">
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

      {/* A day has its totals; the whole history is only a list. */}
      {everyDay ? null : !summary.ok ? (
        <Alert tone="error">Résumé indisponible : {summary.message}</Alert>
      ) : (
        <Card title={dayLabel} titleId="day-summary">
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {/* The total first, on its own line on a phone: the largest
                figure of the screen (DESIGN.md). */}
            <Stat
              label="Total encaissé et à crédit"
              value={money(summary.data.total)}
              className="col-span-2 [--figure-max:2rem] lg:col-span-1"
            />
            <Stat label="Ventes" value={summary.data.count} />
            {PAYMENT_METHODS.filter((m) => summary.data.byMethod[m] > 0).map(
              (m) => (
                <Stat
                  key={m}
                  label={PAYMENT_LABELS[m]}
                  value={money(summary.data.byMethod[m])}
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
                className="flex min-h-16 flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="font-bold">
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
                    {allSales ? ` · ${sale.sellerEmail}` : ''}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {sale.priceReview && (
                    <Badge tone="warning">Prix à vérifier</Badge>
                  )}
                  {sale.stockReview && (
                    <Badge tone="warning">Stock à vérifier</Badge>
                  )}
                  {sale.status === 'cancelled' && (
                    <Badge tone="danger">Annulée</Badge>
                  )}
                  <span
                    className={`text-lg font-extrabold tabular-nums ${sale.status === 'cancelled' ? 'text-ink-muted line-through' : 'text-sales-ink'}`}
                  >
                    {money(sale.total)}
                  </span>
                </span>
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
    <Suspense fallback={<PageFallback />}>
      <Sales {...props} />
    </Suspense>
  );
}
