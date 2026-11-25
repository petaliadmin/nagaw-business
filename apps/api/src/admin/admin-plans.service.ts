import { Injectable } from '@nestjs/common';
import type {
  AdminPlanDto,
  AdminPlanUpdateInput,
  PlanDto,
  PlanRevisionDto,
} from '@nagaw/shared';
import {
  notFound,
  toNumber,
  type Executor,
} from '../catalog/catalog.errors.js';
import type { AuthContext } from '../common/request-context.js';
import { DatabaseService } from '../database/database.service.js';
import { toPlanDto } from '../subscriptions/subscriptions.service.js';

type PlanState = PlanRevisionDto['after'];

const stateOf = (plan: PlanDto): PlanState => ({
  monthlyPrice: plan.monthlyPrice,
  yearlyPrice: plan.yearlyPrice,
  limits: plan.limits,
});

/**
 * The offers as the platform sets them (ADR-075): prices, limits and
 * modules, changed without a deployment, each change kept with its author.
 */
@Injectable()
export class AdminPlansService {
  constructor(private readonly database: DatabaseService) {}

  async list(): Promise<AdminPlanDto[]> {
    const db = this.database.db;
    const [plans, shops, revisions] = await Promise.all([
      db.selectFrom('app.plans').selectAll().orderBy('position').execute(),
      db
        .selectFrom('app.subscriptions as s')
        .innerJoin('app.organizations as o', 'o.id', 's.organization_id')
        .select(['s.plan_key', (eb) => eb.fn.countAll<string>().as('count')])
        .where('o.status', '<>', 'archived')
        .groupBy('s.plan_key')
        .execute(),
      this.revisions(db),
    ]);
    const count = new Map(shops.map((s) => [s.plan_key, toNumber(s.count)]));
    return plans.map((row) => ({
      ...toPlanDto(row),
      yearlyPriceSet:
        row.yearly_price === null ? null : toNumber(row.yearly_price),
      shops: count.get(row.key) ?? 0,
      revisions: revisions.filter((r) => r.planKey === row.key).slice(0, 5),
    }));
  }

  private async revisions(executor: Executor): Promise<PlanRevisionDto[]> {
    const rows = await executor
      .selectFrom('app.plan_revisions as r')
      .innerJoin('app.user_profiles as u', 'u.id', 'r.changed_by')
      .select([
        'r.id',
        'r.plan_key',
        'u.contact',
        'r.before',
        'r.after',
        'r.created_at',
      ])
      .orderBy('r.id', 'desc')
      .limit(100)
      .execute();
    return rows.map((r) => ({
      id: String(r.id),
      planKey: r.plan_key,
      changedBy: r.contact,
      before: r.before as PlanState,
      after: r.after as PlanState,
      createdAt: r.created_at.toISOString(),
    }));
  }

  async update(
    user: AuthContext,
    key: string,
    input: AdminPlanUpdateInput,
  ): Promise<AdminPlanDto> {
    await this.database.db.transaction().execute(async (trx) => {
      const before = await trx
        .selectFrom('app.plans')
        .selectAll()
        .where('key', '=', key)
        .forUpdate()
        .executeTakeFirst();
      if (!before) throw notFound('PLAN_NOT_FOUND', 'Offre introuvable.');
      const { limits } = input;
      const after = await trx
        .updateTable('app.plans')
        .set({
          monthly_price: input.monthlyPrice,
          yearly_price: input.yearlyPrice,
          max_products: limits.products,
          max_members: limits.members,
          max_devices: limits.devices,
          max_sales_per_month: limits.salesPerMonth,
          max_invoices_per_month: limits.invoicesPerMonth,
          max_quotes_per_month: limits.quotesPerMonth,
          max_customers: limits.customers,
          max_suppliers: limits.suppliers,
          history_months: limits.historyMonths,
          modules: limits.modules,
          updated_by: user.userId,
        })
        .where('key', '=', key)
        .returningAll()
        .executeTakeFirstOrThrow();
      await trx
        .insertInto('app.plan_revisions')
        .values({
          plan_key: key,
          changed_by: user.userId,
          before: JSON.stringify(stateOf(toPlanDto(before))),
          after: JSON.stringify(stateOf(toPlanDto(after))),
        })
        .execute();
    });
    return (await this.list()).find((p) => p.key === key)!;
  }
}
