import { Injectable } from '@nestjs/common';
import {
  PAYMENT_METHODS,
  roleHasPermission,
  shareBasisPoints,
  type PaymentMethod,
  type PeriodQuery,
  type ShopSummaryDto,
  type StatsSummaryDto,
  type Unit,
} from '@nagaw/shared';
import { sql } from 'kysely';
import { invalid, toNumber } from '../catalog/catalog.errors.js';
import type { TenantContext } from '../common/request-context.js';
import { today } from '../common/today.js';
import { DatabaseService } from '../database/database.service.js';
import { addDays, TreasuryService } from './treasury.service.js';

/**
 * Sales figures of a period (ADR-027). A sale belongs to the calendar day
 * of its `occurred_at` in the shop's time zone; cancelled sales count for
 * nothing. A line's share of the discount is in proportion of its amount.
 */
@Injectable()
export class StatsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly treasury: TreasuryService,
  ) {}

  private async period(organizationId: string, query: PeriodQuery) {
    const timeZone = await this.treasury.timeZone(
      this.database.db,
      organizationId,
    );
    const to = query.to ?? today(timeZone);
    const from = query.from ?? to;
    if (from > to) throw invalid('to', 'La fin est avant le début.');
    return { timeZone, from, to };
  }

  async summary(
    tenant: TenantContext,
    query: PeriodQuery,
  ): Promise<StatsSummaryDto> {
    const db = this.database.db;
    const organizationId = tenant.organizationId;
    const { timeZone, from, to } = await this.period(organizationId, query);
    const inPeriod = sql`s.organization_id = ${organizationId} and s.status = 'completed'
      and (s.occurred_at at time zone ${timeZone})::date between ${from} and ${to}`;

    const [totals, methods, days, margin, top, slow, expenses] =
      await Promise.all([
        sql<{ count: string; revenue: string; discount: string; tax: string }>`
        select count(*) as count, coalesce(sum(total), 0) as revenue,
               coalesce(sum(discount), 0) as discount, coalesce(sum(tax_total), 0) as tax
          from app.sales s where ${inPeriod}`.execute(db),
        sql<{ method: PaymentMethod; amount: string }>`
        select p.method, sum(p.amount) as amount
          from app.sale_payments p
          join app.sales s on s.organization_id = p.organization_id and s.id = p.sale_id
         where ${inPeriod}
         group by p.method`.execute(db),
        sql<{ day: string; revenue: string; count: string }>`
        select d.day::date::text as day, coalesce(sum(s.total), 0) as revenue, count(s.id) as count
          from generate_series(${from}::date, ${to}::date, interval '1 day') as d(day)
          left join app.sales s on ${inPeriod}
               and (s.occurred_at at time zone ${timeZone})::date = d.day::date
         group by d.day order by d.day`.execute(db),
        sql<{ costed_revenue: string; cost: string }>`
        select coalesce(round(sum(l.line_total::numeric * s.total / nullif(s.subtotal, 0))), 0) as costed_revenue,
               coalesce(round(sum(l.base_quantity * l.unit_cost)), 0) as cost
          from app.sale_lines l
          join app.sales s on s.organization_id = l.organization_id and s.id = l.sale_id
         where ${inPeriod} and l.unit_cost is not null`.execute(db),
        sql<{
          product_id: string;
          label: string;
          unit: Unit;
          quantity: string;
          revenue: string;
        }>`
        select l.product_id, p.name as label, p.unit, sum(l.base_quantity) as quantity,
               coalesce(round(sum(l.line_total::numeric * s.total / nullif(s.subtotal, 0))), 0) as revenue
          from app.sale_lines l
          join app.sales s on s.organization_id = l.organization_id and s.id = l.sale_id
          join app.products p on p.organization_id = l.organization_id and p.id = l.product_id
         where ${inPeriod}
         group by l.product_id, p.name, p.unit
         order by revenue desc, quantity desc
         limit 10`.execute(db),
        sql<{ id: string; name: string; unit: Unit; stock: string }>`
        select p.id, p.name, p.unit, st.quantity as stock
          from app.products p
          join (select product_id, sum(quantity) as quantity from app.stock_movements
                 where organization_id = ${organizationId} group by product_id) st
            on st.product_id = p.id
         where p.organization_id = ${organizationId} and p.status = 'active' and p.track_stock
           and st.quantity > 0
           and not exists (
             select 1 from app.sale_lines l
               join app.sales s on s.organization_id = l.organization_id and s.id = l.sale_id
              where l.organization_id = p.organization_id and l.product_id = p.id and ${inPeriod})
         order by st.quantity * p.sale_price desc, p.name
         limit 10`.execute(db),
        sql<{ amount: string }>`
        select coalesce(sum(amount), 0) as amount from app.expenses
         where organization_id = ${organizationId} and status = 'recorded'
           and occurred_on between ${from} and ${to}`.execute(db),
      ]);

    const row = totals.rows[0]!;
    const count = toNumber(row.count);
    const revenue = toNumber(row.revenue);
    const costedRevenue = toNumber(margin.rows[0]!.costed_revenue);
    const byMethod = Object.fromEntries(
      PAYMENT_METHODS.map((m) => [m, 0]),
    ) as Record<PaymentMethod, number>;
    for (const m of methods.rows) byMethod[m.method] = toNumber(m.amount);
    return {
      from,
      to,
      salesCount: count,
      revenue,
      discount: toNumber(row.discount),
      taxTotal: toNumber(row.tax),
      averageBasket: count === 0 ? 0 : Math.round(revenue / count),
      margin: {
        amount: costedRevenue - toNumber(margin.rows[0]!.cost),
        costedRevenue,
        coverageBasisPoints: shareBasisPoints(costedRevenue, revenue),
      },
      byMethod,
      days: days.rows.map((d) => ({
        day: d.day,
        revenue: toNumber(d.revenue),
        count: toNumber(d.count),
      })),
      topProducts: top.rows.map((p) => ({
        productId: p.product_id,
        label: p.label,
        unit: p.unit,
        quantity: toNumber(p.quantity),
        revenue: toNumber(p.revenue),
      })),
      slowProducts: slow.rows.map((p) => ({
        id: p.id,
        name: p.name,
        unit: p.unit,
        stockQuantity: toNumber(p.stock),
      })),
      expenses: toNumber(expenses.rows[0]!.amount),
    };
  }

  /**
   * Today and the period in each active shop of the person where their
   * role may read statistics: a membership is checked for every shop.
   */
  async shops(userId: string, query: PeriodQuery): Promise<ShopSummaryDto[]> {
    const db = this.database.db;
    const memberships = await db
      .selectFrom('app.organization_memberships as m')
      .innerJoin('app.organizations as o', 'o.id', 'm.organization_id')
      .select(['o.id', 'o.name', 'o.timezone', 'o.default_currency', 'm.role'])
      .where('m.user_id', '=', userId)
      .where('m.status', '=', 'active')
      .where('o.status', '=', 'active')
      .orderBy('o.name')
      .execute();
    const readable = memberships.filter((m) =>
      roleHasPermission(m.role, 'stats.read'),
    );
    return Promise.all(
      readable.map(async (shop) => {
        const day = today(shop.timezone);
        const to = query.to ?? day;
        const from = query.from ?? addDays(to, -29);
        const { rows } = await sql<{
          today_revenue: string;
          today_count: string;
          revenue: string;
          count: string;
        }>`
          select coalesce(sum(total) filter (where d = ${day}), 0) as today_revenue,
                 count(*) filter (where d = ${day}) as today_count,
                 coalesce(sum(total) filter (where d between ${from} and ${to}), 0) as revenue,
                 count(*) filter (where d between ${from} and ${to}) as count
            from (select total, (occurred_at at time zone ${shop.timezone})::date as d
                    from app.sales where organization_id = ${shop.id} and status = 'completed') s`.execute(
          db,
        );
        const r = rows[0]!;
        return {
          organizationId: shop.id,
          name: shop.name,
          currency: shop.default_currency,
          role: shop.role,
          today: {
            revenue: toNumber(r.today_revenue),
            count: toNumber(r.today_count),
          },
          period: { revenue: toNumber(r.revenue), count: toNumber(r.count) },
        };
      }),
    );
  }
}
