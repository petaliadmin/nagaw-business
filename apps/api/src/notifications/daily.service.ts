import { Injectable, Logger } from '@nestjs/common';
import { formatAmount, type Unit } from '@nagaw/shared';
import { sql } from 'kysely';
import {
  toNullableNumber,
  toNumber,
  type Executor,
} from '../catalog/catalog.errors.js';
import { DatabaseService } from '../database/database.service.js';
import { NotificationsService } from './notifications.service.js';
import { PushService } from './push.service.js';
import {
  forecastDaysLeft,
  formatDaysLeft,
  formatQuantity,
  isQuietDay,
  summaryText,
  type DaySummary,
} from './rules.js';

interface DueShop {
  id: string;
  timezone: string;
  currency: string;
  summaryHour: number;
  forecastDays: number;
  forecastWindowDays: number;
  creditOverdueDays: number;
}

/** Local date and hour of a time zone. */
function localNow(timeZone: string, now: Date): { day: string; hour: number } {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone }).format(now);
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(now),
  );
  return { day, hour };
}

function previousDay(day: string, days = 1): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

/**
 * The day whose daily notifications are due: today once the summary hour
 * has passed, yesterday before (a phone opened in the morning gets the
 * summary it missed).
 */
export function dueDay(
  timeZone: string,
  summaryHour: number,
  now: Date,
): string {
  const local = localNow(timeZone, now);
  return local.hour >= summaryHour ? local.day : previousDay(local.day);
}

function dayLabel(day: string): string {
  return new Intl.DateTimeFormat('fr', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${day}T12:00:00Z`));
}

/** Time a scheduled run may spend before handing over to the next one. */
const RUN_BUDGET_MS = 45_000;

/**
 * Notifications prepared once a day per shop (ADR-036): the evening
 * summary, the products that will run out at the current pace and the
 * customers who stopped paying back. A shop's day is claimed in the same
 * transaction as its notifications: the scheduled run (Vercel Cron) and
 * the opening of the application never prepare it twice, and a failure
 * leaves the day to the next attempt.
 */
@Injectable()
export class DailyService {
  private readonly logger = new Logger(DailyService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly notifications: NotificationsService,
    private readonly push: PushService,
  ) {}

  /** Every shop whose day is due (scheduled run). */
  async runDue(now = new Date()): Promise<{ shops: number; pending: number }> {
    const started = Date.now();
    const shops = await this.database.db
      .selectFrom('app.organizations')
      .select([
        'id',
        'timezone',
        'default_currency',
        'daily_summary_hour',
        'stock_forecast_days',
        'stock_forecast_window_days',
        'credit_overdue_days',
        sql<string | null>`daily_run_on::text`.as('daily_run_on'),
      ])
      .where('status', '=', 'active')
      .execute();
    const due = shops.filter(
      (s) =>
        !s.daily_run_on ||
        s.daily_run_on < dueDay(s.timezone, s.daily_summary_hour, now),
    );
    let done = 0;
    for (const shop of due) {
      if (Date.now() - started > RUN_BUDGET_MS) break;
      try {
        if (await this.runShop(this.toDueShop(shop), now)) done += 1;
      } catch (error) {
        // One shop's failure never stops the others; its day stays due.
        this.logger.error(
          { err: error, organizationId: shop.id },
          'Notifications du jour non préparées',
        );
      }
    }
    await this.push.dispatchPending();
    return { shops: done, pending: due.length - done };
  }

  /** The active shop's day, when someone opens the application. */
  async runForOrganization(
    organizationId: string,
    now = new Date(),
  ): Promise<void> {
    const shop = await this.database.db
      .selectFrom('app.organizations')
      .select([
        'id',
        'timezone',
        'default_currency',
        'daily_summary_hour',
        'stock_forecast_days',
        'stock_forecast_window_days',
        'credit_overdue_days',
        sql<string | null>`daily_run_on::text`.as('daily_run_on'),
      ])
      .where('id', '=', organizationId)
      .where('status', '=', 'active')
      .executeTakeFirst();
    if (!shop) return;
    if (
      shop.daily_run_on &&
      shop.daily_run_on >= dueDay(shop.timezone, shop.daily_summary_hour, now)
    )
      return;
    if (await this.runShop(this.toDueShop(shop), now))
      await this.push.dispatchPending(organizationId);
  }

  private toDueShop(row: {
    id: string;
    timezone: string;
    default_currency: string;
    daily_summary_hour: number;
    stock_forecast_days: number;
    stock_forecast_window_days: number;
    credit_overdue_days: number;
  }): DueShop {
    return {
      id: row.id,
      timezone: row.timezone,
      currency: row.default_currency,
      summaryHour: row.daily_summary_hour,
      forecastDays: row.stock_forecast_days,
      forecastWindowDays: row.stock_forecast_window_days,
      creditOverdueDays: row.credit_overdue_days,
    };
  }

  /** Claims the shop's day and prepares it; false when already done. */
  private async runShop(shop: DueShop, now: Date): Promise<boolean> {
    const day = dueDay(shop.timezone, shop.summaryHour, now);
    return this.database.db.transaction().execute(async (trx) => {
      const claimed = await trx
        .updateTable('app.organizations')
        .set({ daily_run_on: day })
        .where('id', '=', shop.id)
        .where((eb) =>
          eb.or([
            eb('daily_run_on', 'is', null),
            sql<boolean>`daily_run_on < ${day}::date`,
          ]),
        )
        .returning('id')
        .executeTakeFirst();
      if (!claimed) return false;
      await this.summary(trx, shop, day);
      await this.forecast(trx, shop, day);
      await this.overdueCredit(trx, shop, day);
      return true;
    });
  }

  // -------------------------------------------------------------------------
  // Evening summary
  // -------------------------------------------------------------------------

  private async summary(trx: Executor, shop: DueShop, day: string) {
    const onDay = (column: string, d: string) =>
      sql<boolean>`(${sql.ref(column)} at time zone ${shop.timezone})::date = ${d}::date`;
    const salesOf = (d: string) =>
      trx
        .selectFrom('app.sales as s')
        .select([
          sql<string>`count(*) filter (where s.status = 'completed')`.as(
            'count',
          ),
          sql<string>`coalesce(sum(s.total) filter (where s.status = 'completed'), 0)`.as(
            'total',
          ),
          sql<string>`count(*) filter (where s.status = 'cancelled')`.as(
            'cancelled',
          ),
        ])
        .where('s.organization_id', '=', shop.id)
        .where(onDay('s.occurred_at', d))
        .executeTakeFirstOrThrow();

    const [sales, lastWeek, credit, top, invoices, expenses, stock] =
      await Promise.all([
        salesOf(day),
        salesOf(previousDay(day, 7)),
        trx
          .selectFrom('app.sale_payments as p')
          .innerJoin('app.sales as s', (join) =>
            join
              .onRef('s.organization_id', '=', 'p.organization_id')
              .onRef('s.id', '=', 'p.sale_id'),
          )
          .select(sql<string>`coalesce(sum(p.amount), 0)`.as('total'))
          .where('s.organization_id', '=', shop.id)
          .where('s.status', '=', 'completed')
          .where('p.method', '=', 'credit')
          .where(onDay('s.occurred_at', day))
          .executeTakeFirstOrThrow(),
        trx
          .selectFrom('app.sale_lines as l')
          .innerJoin('app.sales as s', (join) =>
            join
              .onRef('s.organization_id', '=', 'l.organization_id')
              .onRef('s.id', '=', 'l.sale_id'),
          )
          .select(['l.label'])
          .select(sql<string>`sum(l.line_total)`.as('total'))
          .where('s.organization_id', '=', shop.id)
          .where('s.status', '=', 'completed')
          .where(onDay('s.occurred_at', day))
          .groupBy('l.label')
          .orderBy(sql`sum(l.line_total)`, 'desc')
          .limit(3)
          .execute(),
        trx
          .selectFrom('app.invoices')
          .select([
            sql<string>`count(*)`.as('count'),
            sql<string>`coalesce(sum(total), 0)`.as('total'),
          ])
          .where('organization_id', '=', shop.id)
          .where('kind', '=', 'invoice')
          .where('issued_at', 'is not', null)
          .where(onDay('issued_at', day))
          .executeTakeFirstOrThrow(),
        trx
          .selectFrom('app.expenses')
          .select([
            sql<string>`count(*)`.as('count'),
            sql<string>`coalesce(sum(amount), 0)`.as('total'),
          ])
          .where('organization_id', '=', shop.id)
          .where('status', '=', 'recorded')
          .where('occurred_on', '=', day)
          .executeTakeFirstOrThrow(),
        this.stockLevels(trx, shop.id),
      ]);

    const data: DaySummary = {
      dayLabel: dayLabel(day),
      currency: shop.currency,
      sales: {
        count: Number(sales.count),
        total: toNumber(sales.total),
        cancelled: Number(sales.cancelled),
      },
      lastWeekTotal: toNumber(lastWeek.total),
      credit: toNumber(credit.total),
      topProducts: top.map((t) => ({
        label: t.label,
        total: toNumber(t.total),
      })),
      invoices: {
        count: Number(invoices.count),
        total: toNumber(invoices.total),
      },
      expenses: {
        count: Number(expenses.count),
        total: toNumber(expenses.total),
      },
      stock: {
        low: stock.filter((p) => p.level === 'low').length,
        out: stock.filter((p) => p.level === 'out').length,
      },
    };
    if (isQuietDay(data)) return;
    const text = summaryText(data);
    await this.notifications.notify(trx, {
      organizationId: shop.id,
      category: 'summary',
      kind: 'summary.daily',
      title: text.title,
      body: text.body,
      link: '/espace/statistiques',
      groupKey: `summary:${day}`,
      data: { day, total: data.sales.total, count: data.sales.count },
    });
  }

  /** Tracked active products with their stock and level. */
  private async stockLevels(trx: Executor, organizationId: string) {
    const rows = await trx
      .selectFrom('app.products as p')
      .leftJoin(
        (eb) =>
          eb
            .selectFrom('app.stock_movements')
            .select(['product_id'])
            .select((s) => s.fn.sum<string>('quantity').as('quantity'))
            .where('organization_id', '=', organizationId)
            .groupBy('product_id')
            .as('m'),
        (join) => join.onRef('m.product_id', '=', 'p.id'),
      )
      .select(['p.id', 'p.name', 'p.unit', 'p.low_stock_threshold'])
      .select(sql<string>`coalesce(m.quantity, 0)`.as('stock'))
      .where('p.organization_id', '=', organizationId)
      .where('p.status', '=', 'active')
      .where('p.track_stock', '=', true)
      .execute();
    return rows.map((row) => {
      const stock = toNumber(row.stock);
      const threshold = toNullableNumber(row.low_stock_threshold);
      return {
        id: row.id,
        name: row.name,
        unit: row.unit as Unit,
        stock,
        level:
          stock <= 0
            ? ('out' as const)
            : threshold !== null && stock <= threshold
              ? ('low' as const)
              : ('ok' as const),
      };
    });
  }

  // -------------------------------------------------------------------------
  // Products that will run out
  // -------------------------------------------------------------------------

  private async forecast(trx: Executor, shop: DueShop, day: string) {
    const since = new Date(Date.now() - shop.forecastWindowDays * 86_400_000);
    const [products, sold, recent] = await Promise.all([
      this.stockLevels(trx, shop.id),
      trx
        .selectFrom('app.stock_movements')
        .select(['product_id'])
        .select(sql<string>`-sum(quantity)`.as('sold'))
        .where('organization_id', '=', shop.id)
        .where('kind', 'in', ['sale', 'return'])
        .where('created_at', '>=', since)
        .groupBy('product_id')
        .execute(),
      // Products already announced lately are not repeated every day.
      trx
        .selectFrom('app.notifications')
        .select('data')
        .where('organization_id', '=', shop.id)
        .where('kind', '=', 'stock.forecast')
        .where(
          'created_at',
          '>=',
          new Date(Date.now() - shop.forecastDays * 86_400_000),
        )
        .execute(),
    ]);
    const announced = new Set(
      recent.flatMap((r) =>
        Array.isArray(r.data.productIds) ? (r.data.productIds as string[]) : [],
      ),
    );
    const soldBy = new Map(sold.map((s) => [s.product_id, toNumber(s.sold)]));
    const soon = products
      .filter((p) => p.level !== 'out' && !announced.has(p.id))
      .map((p) => ({
        ...p,
        days: forecastDaysLeft(
          p.stock,
          soldBy.get(p.id) ?? 0,
          shop.forecastWindowDays,
        ),
      }))
      .filter(
        (p): p is typeof p & { days: number } =>
          p.days !== null && p.days < shop.forecastDays,
      )
      .sort((a, b) => a.days - b.days);
    if (soon.length === 0) return;
    const shown = soon.slice(0, 5);
    await this.notifications.notify(trx, {
      organizationId: shop.id,
      category: 'stock',
      kind: 'stock.forecast',
      severity: 'warning',
      title:
        soon.length > 1
          ? `${soon.length} produits seront bientôt épuisés`
          : `${soon[0]!.name} sera bientôt épuisé`,
      body:
        shown
          .map(
            (p) =>
              `${p.name} : ${formatDaysLeft(p.days)} (reste ${formatQuantity(p.stock, p.unit)})`,
          )
          .join('\n') +
        (soon.length > shown.length
          ? `\nEt ${soon.length - shown.length} autres.`
          : '') +
        `\nAu rythme des ventes des ${shop.forecastWindowDays} derniers jours.`,
      link: '/espace/produits?stock=low',
      groupKey: `forecast:${day}`,
      data: { productIds: soon.map((p) => p.id) },
    });
  }

  // -------------------------------------------------------------------------
  // Customers who stopped paying back
  // -------------------------------------------------------------------------

  private async overdueCredit(trx: Executor, shop: DueShop, day: string) {
    const limit = new Date(Date.now() - shop.creditOverdueDays * 86_400_000);
    const rows = await trx
      .selectFrom('app.customers as c')
      .select(['c.id', 'c.name'])
      .select([
        sql<string>`coalesce((select sum(p.amount) from app.sale_payments p join app.sales s on s.organization_id = p.organization_id and s.id = p.sale_id where s.organization_id = c.organization_id and s.customer_id = c.id and s.status = 'completed' and p.method = 'credit'), 0)
          - coalesce((select sum(r.amount) from app.customer_payments r where r.organization_id = c.organization_id and r.customer_id = c.id), 0)`.as(
          'balance',
        ),
        sql<Date | null>`(select max(r.created_at) from app.customer_payments r where r.organization_id = c.organization_id and r.customer_id = c.id)`.as(
          'last_repayment',
        ),
        sql<Date | null>`(select min(s.occurred_at) from app.sales s join app.sale_payments p on p.organization_id = s.organization_id and p.sale_id = s.id where s.organization_id = c.organization_id and s.customer_id = c.id and s.status = 'completed' and p.method = 'credit')`.as(
          'first_credit',
        ),
      ])
      .where('c.organization_id', '=', shop.id)
      .where('c.status', '=', 'active')
      .execute();
    const overdue = rows
      .map((row) => ({ ...row, balance: toNumber(row.balance) }))
      .filter(
        (row) =>
          row.balance > 0 &&
          row.first_credit !== null &&
          new Date(row.first_credit) < limit &&
          (row.last_repayment === null || new Date(row.last_repayment) < limit),
      )
      .sort((a, b) => b.balance - a.balance);
    if (overdue.length === 0) return;

    const recent = await trx
      .selectFrom('app.notifications')
      .select('data')
      .where('organization_id', '=', shop.id)
      .where('kind', '=', 'credit.overdue')
      .where('created_at', '>=', limit)
      .execute();
    const told = new Set(
      recent.flatMap((r) =>
        Array.isArray(r.data.customerIds)
          ? (r.data.customerIds as string[])
          : [],
      ),
    );
    // Only when someone new joins the list: the same names are not repeated
    // before the delay has passed again.
    if (overdue.every((c) => told.has(c.id))) return;

    const money = (value: number) => formatAmount(value, shop.currency);
    const total = overdue.reduce((sum, c) => sum + c.balance, 0);
    const shown = overdue.slice(0, 5);
    await this.notifications.notify(trx, {
      organizationId: shop.id,
      category: 'credit',
      kind: 'credit.overdue',
      severity: 'warning',
      title:
        overdue.length > 1
          ? `${overdue.length} clients ne remboursent plus : ${money(total)}`
          : `${overdue[0]!.name} ne rembourse plus : ${money(total)}`,
      body:
        shown.map((c) => `${c.name} : ${money(c.balance)}`).join('\n') +
        (overdue.length > shown.length
          ? `\nEt ${overdue.length - shown.length} autres.`
          : '') +
        `\nAucun remboursement depuis plus de ${shop.creditOverdueDays} jours.`,
      link: '/espace/clients?owing=true',
      groupKey: `credit-overdue:${day}`,
      data: { customerIds: overdue.map((c) => c.id) },
    });
  }
}
