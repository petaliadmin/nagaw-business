import { Injectable } from '@nestjs/common';
import type {
  DismissStockSuggestionInput,
  StockSuggestionDto,
  Unit,
} from '@nagaw/shared';
import { sql } from 'kysely';
import { AuditService } from '../audit/audit.service.js';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { DatabaseService } from '../database/database.service.js';
import { toNumber, UUID_RE } from './catalog.errors.js';
import { productNotFound } from './products.service.js';

/** At most this many suggestions at once: the home page stays short. */
export const SUGGESTIONS_SHOWN = 3;

/**
 * Products sold often whose stock is not counted (ADR-070). The thresholds
 * are the shop's (`stock_suggestion_*` columns), never written here.
 */
@Injectable()
export class StockSuggestionsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  async list(organizationId: string): Promise<StockSuggestionDto[]> {
    const db = this.database.db;
    const shop = await db
      .selectFrom('app.organizations')
      .select(['stock_suggestion_min_sales', 'stock_suggestion_window_days'])
      .where('id', '=', organizationId)
      .executeTakeFirstOrThrow();
    const windowDays = shop.stock_suggestion_window_days;
    const { rows } = await sql<{
      id: string;
      name: string;
      unit: Unit;
      sales: string;
    }>`
      select p.id, p.name, p.unit, count(distinct l.sale_id) as sales
        from app.sale_lines l
        join app.sales s
          on s.organization_id = l.organization_id and s.id = l.sale_id
        join app.products p
          on p.organization_id = l.organization_id and p.id = l.product_id
        left join app.stock_suggestion_dismissals d
          on d.organization_id = p.organization_id and d.product_id = p.id
       where l.organization_id = ${organizationId}
         and s.status = 'completed'
         and s.occurred_at >= now() - make_interval(days => ${windowDays})
         and p.status = 'active'
         and p.kind = 'product'
         and not p.track_stock
         and p.system_role is null
         and (d.product_id is null or (d.until is not null and d.until <= now()))
       group by p.id, p.name, p.unit
      having count(distinct l.sale_id) >= ${shop.stock_suggestion_min_sales}
       order by count(distinct l.sale_id) desc, p.name
       limit ${SUGGESTIONS_SHOWN}`.execute(db);
    return rows.map((row) => ({
      productId: row.id,
      name: row.name,
      unit: row.unit,
      sales: toNumber(row.sales),
      windowDays,
    }));
  }

  /** « Plus tard » or « Ne plus proposer ». */
  async dismiss(
    tenant: TenantContext,
    user: AuthContext,
    productId: string,
    input: DismissStockSuggestionInput,
    requestId: string | null,
  ): Promise<void> {
    if (!UUID_RE.test(productId)) throw productNotFound();
    await this.database.db.transaction().execute(async (trx) => {
      const product = await trx
        .selectFrom('app.products')
        .select('id')
        .where('organization_id', '=', tenant.organizationId)
        .where('id', '=', productId)
        .executeTakeFirst();
      if (!product) throw productNotFound();
      const { stock_suggestion_snooze_days: snooze } = await trx
        .selectFrom('app.organizations')
        .select('stock_suggestion_snooze_days')
        .where('id', '=', tenant.organizationId)
        .executeTakeFirstOrThrow();
      const until =
        input.choice === 'never'
          ? null
          : new Date(Date.now() + snooze * 24 * 60 * 60 * 1000);
      await trx
        .insertInto('app.stock_suggestion_dismissals')
        .values({
          organization_id: tenant.organizationId,
          product_id: productId,
          until,
          dismissed_by: user.userId,
        })
        .onConflict((oc) =>
          oc.columns(['organization_id', 'product_id']).doUpdateSet({
            until,
            dismissed_by: user.userId,
            dismissed_at: sql`now()`,
          }),
        )
        .execute();
      await this.audit.record(trx, {
        organizationId: tenant.organizationId,
        actorType: 'user',
        actorId: user.userId,
        action: 'stock_suggestion.dismissed',
        targetType: 'product',
        targetId: productId,
        metadata: { choice: input.choice },
        requestId,
      });
    });
  }
}
