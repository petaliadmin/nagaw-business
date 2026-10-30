import { Injectable } from '@nestjs/common';
import {
  shareBasisPoints,
  type AdminActivityDto,
  type AdminAlertDto,
  type AdminFinancesDto,
  type AdminOverviewDto,
  type AdminPlanRequestDto,
  type AdminShopDto,
  type AdminShopListItemDto,
  type AdminShopQuery,
  type AdminSyncDto,
} from '@nagaw/shared';
import { sql, type Transaction } from 'kysely';
import { AuditService } from '../audit/audit.service.js';
import {
  conflict,
  invalid,
  notFound,
  toNumber,
  UUID_RE,
  type Executor,
} from '../catalog/catalog.errors.js';
import { pageOf } from '../common/page.js';
import type { AuthContext } from '../common/request-context.js';
import { DatabaseService } from '../database/database.service.js';
import type { Database } from '../database/schema.js';

const shopNotFound = () => notFound('SHOP_NOT_FOUND', 'Boutique introuvable.');
const requestNotFound = () =>
  notFound('PLAN_REQUEST_NOT_FOUND', 'Demande introuvable.');

interface ShopRow {
  id: string;
  name: string;
  status: 'active' | 'suspended';
  created_at: Date;
  plan_key: string;
  plan_name: string;
  owner_emails: string[] | null;
  members: string;
  last_sale_at: Date | null;
}

/**
 * Platform administration (ADR-030): accounts, offers and aggregates of the
 * shops; never their products, sales or customers, which the administrator
 * sees only inside a shop entered with a reason (ADR-040). Every change is
 * audited in the shop's own history, as done by the platform.
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  private settings(executor: Executor) {
    return executor
      .selectFrom('app.platform_settings')
      .selectAll()
      .executeTakeFirstOrThrow();
  }

  private shopsQuery(executor: Executor) {
    return executor
      .selectFrom('app.organizations as o')
      .innerJoin('app.subscriptions as s', 's.organization_id', 'o.id')
      .innerJoin('app.plans as p', 'p.key', 's.plan_key')
      .select([
        'o.id',
        'o.name',
        'o.status',
        'o.created_at',
        's.plan_key',
        'p.name as plan_name',
      ])
      .select(
        sql<string[] | null>`(select array_agg(u.email order by u.email)
          from app.organization_memberships m join app.user_profiles u on u.id = m.user_id
          where m.organization_id = o.id and m.role = 'owner' and m.status = 'active')`.as(
          'owner_emails',
        ),
      )
      .select(
        sql<string>`(select count(*) from app.organization_memberships m
          where m.organization_id = o.id and m.status = 'active')`.as(
          'members',
        ),
      )
      .select(
        sql<Date | null>`(select max(occurred_at) from app.sales x where x.organization_id = o.id)`.as(
          'last_sale_at',
        ),
      );
  }

  private toListItem(row: ShopRow): AdminShopListItemDto {
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      plan: { key: row.plan_key, name: row.plan_name },
      ownerEmails: row.owner_emails ?? [],
      members: toNumber(row.members),
      createdAt: row.created_at.toISOString(),
      lastSaleAt: row.last_sale_at
        ? new Date(row.last_sale_at).toISOString()
        : null,
    };
  }

  async shops(query: AdminShopQuery): Promise<AdminShopListItemDto[]> {
    let q = this.shopsQuery(this.database.db);
    if (query.status) q = q.where('o.status', '=', query.status);
    if (query.q) {
      const like = `%${query.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      q = q.where((eb) =>
        eb.or([
          eb('o.name', 'ilike', like),
          eb.exists(
            eb
              .selectFrom('app.organization_memberships as m')
              .innerJoin('app.user_profiles as u', 'u.id', 'm.user_id')
              .select('m.user_id')
              .whereRef('m.organization_id', '=', 'o.id')
              .where('u.email', 'ilike', like),
          ),
        ]),
      );
    }
    const rows = await pageOf(
      q.orderBy('o.created_at', 'desc').orderBy('o.id', 'desc'),
      query,
      200,
    ).execute();
    return rows.map((r) => this.toListItem(r as ShopRow));
  }

  private async requestsOf(
    executor: Executor,
    organizationId: string | null,
    pendingOnly: boolean,
  ) {
    let q = executor
      .selectFrom('app.plan_change_requests as r')
      .innerJoin('app.organizations as o', 'o.id', 'r.organization_id')
      .innerJoin(
        'app.subscriptions as s',
        's.organization_id',
        'r.organization_id',
      )
      .innerJoin('app.plans as cur', 'cur.key', 's.plan_key')
      .innerJoin('app.plans as want', 'want.key', 'r.plan_key')
      .innerJoin('app.user_profiles as u', 'u.id', 'r.requested_by')
      .select([
        'r.id',
        'r.organization_id',
        'o.name as shop_name',
        's.plan_key as from_key',
        'cur.name as from_name',
        'r.plan_key as to_key',
        'want.name as to_name',
        'u.email',
        'r.status',
        'r.resolution_note',
        'r.created_at',
        'r.resolved_at',
      ]);
    if (organizationId) q = q.where('r.organization_id', '=', organizationId);
    if (pendingOnly) q = q.where('r.status', '=', 'pending');
    const rows = await q.orderBy('r.created_at', 'desc').limit(200).execute();
    return rows.map((r): AdminPlanRequestDto => ({
      id: r.id,
      shop: { id: r.organization_id, name: r.shop_name },
      from: { key: r.from_key, name: r.from_name },
      to: { key: r.to_key, name: r.to_name },
      requestedBy: r.email,
      status: r.status,
      note: r.resolution_note,
      createdAt: r.created_at.toISOString(),
      resolvedAt: r.resolved_at ? r.resolved_at.toISOString() : null,
    }));
  }

  requests(pendingOnly: boolean): Promise<AdminPlanRequestDto[]> {
    return this.requestsOf(this.database.db, null, pendingOnly);
  }

  async shop(
    id: string,
    adminId: string,
    executor: Executor = this.database.db,
  ): Promise<AdminShopDto> {
    if (!UUID_RE.test(id)) throw shopNotFound();
    const row = await this.shopsQuery(executor)
      .select([
        'o.timezone',
        'o.default_currency',
        'o.max_products',
        'o.max_members',
        'o.max_devices',
        'o.suspended_at',
        'o.suspension_reason',
      ])
      .select(
        sql<string>`(select count(*) from app.products x where x.organization_id = o.id and x.status = 'active')`.as(
          'products',
        ),
      )
      .where('o.id', '=', id)
      .executeTakeFirst();
    if (!row) throw shopNotFound();
    const devices = await executor
      .selectFrom('app.devices')
      .select(['id', 'label', 'last_synced_at', 'revoked_at'])
      .where('organization_id', '=', id)
      .orderBy('created_at')
      .execute();
    const active = devices.filter((d) => d.revoked_at === null).length;
    const access = await executor
      .selectFrom('app.platform_shop_accesses')
      .select(['opened_at', 'reason'])
      .where('organization_id', '=', id)
      .where('admin_id', '=', adminId)
      .where('closed_at', 'is', null)
      .executeTakeFirst();
    return {
      ...this.toListItem(row as ShopRow),
      timezone: row.timezone,
      currency: row.default_currency,
      usage: {
        products: toNumber(row.products),
        members: toNumber(row.members),
        devices: active,
      },
      limits: {
        products: row.max_products,
        members: row.max_members,
        devices: row.max_devices,
      },
      suspension:
        row.suspended_at && row.suspension_reason
          ? {
              at: row.suspended_at.toISOString(),
              reason: row.suspension_reason,
            }
          : null,
      devices: devices.map((d) => ({
        id: d.id,
        label: d.label,
        lastSyncedAt: d.last_synced_at ? d.last_synced_at.toISOString() : null,
        revoked: d.revoked_at !== null,
      })),
      requests: await this.requestsOf(executor, id, false),
      access: access
        ? { openedAt: access.opened_at.toISOString(), reason: access.reason }
        : null,
    };
  }

  /**
   * The administrator enters the shop, with the rights of an owner, until
   * the access is closed (ADR-040); the reason goes to the shop's history.
   */
  async openAccess(
    admin: AuthContext,
    id: string,
    reason: string,
    requestId: string | null,
  ): Promise<AdminShopDto> {
    if (!UUID_RE.test(id)) throw shopNotFound();
    return this.database.db.transaction().execute(async (trx) => {
      const shop = await this.lockShop(trx, id);
      if (shop.status !== 'active')
        throw conflict(
          'SHOP_SUSPENDED',
          'Cette boutique est suspendue : réactivez-la avant d’y entrer.',
        );
      const open = await trx
        .selectFrom('app.platform_shop_accesses')
        .select('id')
        .where('organization_id', '=', id)
        .where('admin_id', '=', admin.userId)
        .where('closed_at', 'is', null)
        .executeTakeFirst();
      if (open)
        throw conflict(
          'ACCESS_ALREADY_OPEN',
          'Vous avez déjà accès à cette boutique.',
        );
      const access = await trx
        .insertInto('app.platform_shop_accesses')
        .values({ organization_id: id, admin_id: admin.userId, reason })
        .returning('id')
        .executeTakeFirstOrThrow();
      await this.audit.record(trx, {
        organizationId: id,
        actorType: 'platform_admin',
        actorId: admin.userId,
        action: 'platform.access_opened',
        targetType: 'platform_access',
        targetId: access.id,
        metadata: { reason },
        requestId,
      });
      return this.shop(id, admin.userId, trx);
    });
  }

  async closeAccess(
    admin: AuthContext,
    id: string,
    requestId: string | null,
  ): Promise<AdminShopDto> {
    if (!UUID_RE.test(id)) throw shopNotFound();
    return this.database.db.transaction().execute(async (trx) => {
      await this.lockShop(trx, id);
      const closed = await trx
        .updateTable('app.platform_shop_accesses')
        .set({ closed_at: new Date() })
        .where('organization_id', '=', id)
        .where('admin_id', '=', admin.userId)
        .where('closed_at', 'is', null)
        .returning('id')
        .executeTakeFirst();
      if (!closed)
        throw conflict(
          'NO_OPEN_ACCESS',
          'Vous n’avez pas d’accès ouvert à cette boutique.',
        );
      await this.audit.record(trx, {
        organizationId: id,
        actorType: 'platform_admin',
        actorId: admin.userId,
        action: 'platform.access_closed',
        targetType: 'platform_access',
        targetId: closed.id,
        requestId,
      });
      return this.shop(id, admin.userId, trx);
    });
  }

  private async changePlan(
    trx: Transaction<Database>,
    admin: AuthContext,
    organizationId: string,
    planKey: string,
    requestId: string | null,
    origin: Record<string, unknown>,
  ) {
    const plan = await trx
      .selectFrom('app.plans')
      .select(['key', 'name'])
      .where('key', '=', planKey)
      .executeTakeFirst();
    if (!plan) throw invalid('planKey', 'Offre inconnue.');
    const current = await trx
      .selectFrom('app.subscriptions')
      .select('plan_key')
      .where('organization_id', '=', organizationId)
      .executeTakeFirst();
    if (!current) throw shopNotFound();
    if (current.plan_key === plan.key)
      throw conflict(
        'ALREADY_ON_PLAN',
        `La boutique est déjà sur l’offre ${plan.name}.`,
      );
    await trx
      .updateTable('app.subscriptions')
      .set({ plan_key: plan.key, changed_by: admin.userId })
      .where('organization_id', '=', organizationId)
      .execute();
    await this.audit.record(trx, {
      organizationId,
      actorType: 'platform_admin',
      actorId: admin.userId,
      action: 'subscription.plan_changed',
      targetType: 'organization',
      targetId: organizationId,
      metadata: { from: current.plan_key, to: plan.key, ...origin },
      requestId,
    });
  }

  /** The platform puts a shop on an offer (payment received off-line…). */
  async setPlan(
    admin: AuthContext,
    id: string,
    planKey: string,
    note: string,
    requestId: string | null,
  ) {
    if (!UUID_RE.test(id)) throw shopNotFound();
    return this.database.db.transaction().execute(async (trx) => {
      await this.lockShop(trx, id);
      await this.changePlan(
        trx,
        admin,
        id,
        planKey,
        requestId,
        note ? { note } : {},
      );
      // A pending request for this very offer is thereby fulfilled.
      await trx
        .updateTable('app.plan_change_requests')
        .set({
          status: 'done',
          resolved_at: new Date(),
          resolved_by: admin.userId,
          resolution_note: note,
        })
        .where('organization_id', '=', id)
        .where('status', '=', 'pending')
        .where('plan_key', '=', planKey)
        .execute();
      return this.shop(id, admin.userId, trx);
    });
  }

  private async lockShop(trx: Transaction<Database>, id: string) {
    const shop = await trx
      .selectFrom('app.organizations')
      .select(['id', 'status', 'name'])
      .where('id', '=', id)
      .forUpdate()
      .executeTakeFirst();
    if (!shop) throw shopNotFound();
    return shop;
  }

  async resolveRequest(
    admin: AuthContext,
    id: string,
    decision: 'approve' | 'reject',
    note: string,
    requestId: string | null,
  ): Promise<AdminPlanRequestDto> {
    if (!UUID_RE.test(id)) throw requestNotFound();
    return this.database.db.transaction().execute(async (trx) => {
      const request = await trx
        .selectFrom('app.plan_change_requests')
        .select(['id', 'organization_id', 'plan_key', 'status'])
        .where('id', '=', id)
        .forUpdate()
        .executeTakeFirst();
      if (!request) throw requestNotFound();
      if (request.status !== 'pending')
        throw conflict(
          'PLAN_REQUEST_NOT_PENDING',
          'Cette demande a déjà été traitée ou annulée.',
        );
      await this.lockShop(trx, request.organization_id);
      if (decision === 'approve')
        await this.changePlan(
          trx,
          admin,
          request.organization_id,
          request.plan_key,
          requestId,
          {
            requestIdOfChange: request.id,
          },
        );
      else
        await this.audit.record(trx, {
          organizationId: request.organization_id,
          actorType: 'platform_admin',
          actorId: admin.userId,
          action: 'subscription.change_rejected',
          targetType: 'plan_change_request',
          targetId: request.id,
          metadata: { to: request.plan_key, note },
          requestId,
        });
      await trx
        .updateTable('app.plan_change_requests')
        .set({
          status: decision === 'approve' ? 'done' : 'rejected',
          resolved_at: new Date(),
          resolved_by: admin.userId,
          resolution_note: note,
        })
        .where('id', '=', request.id)
        .execute();
      const [resolved] = (
        await this.requestsOf(trx, request.organization_id, false)
      ).filter((r) => r.id === id);
      return resolved!;
    });
  }

  async setSuspended(
    admin: AuthContext,
    id: string,
    reason: string | null,
    requestId: string | null,
  ): Promise<AdminShopDto> {
    if (!UUID_RE.test(id)) throw shopNotFound();
    return this.database.db.transaction().execute(async (trx) => {
      const shop = await this.lockShop(trx, id);
      const suspend = reason !== null;
      if (suspend === (shop.status === 'suspended'))
        throw conflict(
          'SHOP_STATUS_UNCHANGED',
          suspend
            ? 'Cette boutique est déjà suspendue.'
            : 'Cette boutique n’est pas suspendue.',
        );
      await trx
        .updateTable('app.organizations')
        .set(
          suspend
            ? {
                status: 'suspended',
                suspended_at: new Date(),
                suspension_reason: reason,
              }
            : { status: 'active', suspended_at: null, suspension_reason: null },
        )
        .where('id', '=', id)
        .execute();
      await this.audit.record(trx, {
        organizationId: id,
        actorType: 'platform_admin',
        actorId: admin.userId,
        action: suspend ? 'organization.suspended' : 'organization.reactivated',
        targetType: 'organization',
        targetId: id,
        metadata: suspend ? { reason } : {},
        requestId,
      });
      return this.shop(id, admin.userId, trx);
    });
  }

  /**
   * What the offers in force should bring each month (ADR-041); payments
   * are made outside the application, so none of it is money received.
   */
  async finances(): Promise<AdminFinancesDto> {
    const db = this.database.db;
    const plans = await db
      .selectFrom('app.plans')
      .select(['key', 'name', 'monthly_price', 'currency'])
      .orderBy('position')
      .execute();
    const currencies = new Set(plans.map((p) => p.currency));
    if (currencies.size !== 1)
      throw conflict(
        'PLANS_MIXED_CURRENCIES',
        'Les offres ne sont pas toutes dans la même devise : les revenus ne peuvent pas être additionnés.',
      );
    const [shops, pending, months, movements] = await Promise.all([
      db
        .selectFrom('app.subscriptions as s')
        .innerJoin('app.organizations as o', 'o.id', 's.organization_id')
        .select(['s.plan_key', (eb) => eb.fn.countAll<string>().as('shops')])
        .where('o.status', '=', 'active')
        .groupBy('s.plan_key')
        .execute(),
      sql<{ requests: string; change: string | null }>`
        select count(*) as requests, sum(want.monthly_price - cur.monthly_price) as change
          from app.plan_change_requests r
          join app.subscriptions s on s.organization_id = r.organization_id
          join app.plans cur on cur.key = s.plan_key
          join app.plans want on want.key = r.plan_key
         where r.status = 'pending'`.execute(db),
      // The offer and the suspension of each shop at the end of each month,
      // read from the history; before any change, the first one tells the
      // state it started from; without any, the present state holds.
      sql<{ month: string; revenue: string; paying: string }>`
        with months as (
          select m as month,
                 least((m + interval '1 month') at time zone 'UTC', now()) as month_end
            from generate_series(date_trunc('month', now() at time zone 'UTC') - interval '11 months',
                                 date_trunc('month', now() at time zone 'UTC'), interval '1 month') as m
        ),
        state as (
          select mo.month,
                 coalesce(
                   (select a.metadata->>'to' from app.audit_logs a
                     where a.organization_id = o.id and a.action = 'subscription.plan_changed'
                       and a.created_at < mo.month_end order by a.id desc limit 1),
                   (select a.metadata->>'from' from app.audit_logs a
                     where a.organization_id = o.id and a.action = 'subscription.plan_changed'
                       and a.created_at >= mo.month_end order by a.id limit 1),
                   s.plan_key) as plan_key,
                 coalesce(
                   (select a.action = 'organization.suspended' from app.audit_logs a
                     where a.organization_id = o.id
                       and a.action in ('organization.suspended', 'organization.reactivated')
                       and a.created_at < mo.month_end order by a.id desc limit 1),
                   (select a.action = 'organization.reactivated' from app.audit_logs a
                     where a.organization_id = o.id
                       and a.action in ('organization.suspended', 'organization.reactivated')
                       and a.created_at >= mo.month_end order by a.id limit 1),
                   o.status = 'suspended') as suspended
            from months mo
            join app.organizations o on o.created_at < mo.month_end
            join app.subscriptions s on s.organization_id = o.id
        )
        select to_char(mo.month, 'YYYY-MM') as month,
               coalesce(sum(p.monthly_price) filter (where not st.suspended), 0) as revenue,
               count(st.plan_key) filter (where not st.suspended and p.monthly_price > 0) as paying
          from months mo
          left join state st on st.month = mo.month
          left join app.plans p on p.key = st.plan_key
         group by mo.month
         order by mo.month`.execute(db),
      sql<{ month: string; upgrades: string; downgrades: string }>`
        select to_char(date_trunc('month', a.created_at at time zone 'UTC'), 'YYYY-MM') as month,
               count(*) filter (where pt.monthly_price > pf.monthly_price) as upgrades,
               count(*) filter (where pt.monthly_price < pf.monthly_price) as downgrades
          from app.audit_logs a
          join app.plans pf on pf.key = a.metadata->>'from'
          join app.plans pt on pt.key = a.metadata->>'to'
         where a.action = 'subscription.plan_changed'
           and a.created_at >= (date_trunc('month', now() at time zone 'UTC') - interval '11 months') at time zone 'UTC'
         group by 1`.execute(db),
    ]);

    const shopsOf = new Map(shops.map((s) => [s.plan_key, toNumber(s.shops)]));
    const byPlan = plans.map((p) => {
      const count = shopsOf.get(p.key) ?? 0;
      const price = toNumber(p.monthly_price);
      return {
        key: p.key,
        name: p.name,
        monthlyPrice: price,
        shops: count,
        expectedMonthlyRevenue: price * count,
      };
    });
    const moves = new Map(movements.rows.map((m) => [m.month, m]));
    return {
      currency: plans[0]!.currency,
      expectedMonthlyRevenue: byPlan.reduce(
        (sum, p) => sum + p.expectedMonthlyRevenue,
        0,
      ),
      payingShops: byPlan
        .filter((p) => p.monthlyPrice > 0)
        .reduce((sum, p) => sum + p.shops, 0),
      activeShops: byPlan.reduce((sum, p) => sum + p.shops, 0),
      byPlan,
      pending: {
        requests: toNumber(pending.rows[0]!.requests),
        expectedMonthlyChange: toNumber(pending.rows[0]!.change ?? '0'),
      },
      months: months.rows.map((m) => ({
        month: m.month,
        expectedMonthlyRevenue: toNumber(m.revenue),
        payingShops: toNumber(m.paying),
        upgrades: toNumber(moves.get(m.month)?.upgrades ?? '0'),
        downgrades: toNumber(moves.get(m.month)?.downgrades ?? '0'),
      })),
    };
  }

  /** The shops all together: sales, new shops and accounts (ADR-041). */
  async activity(): Promise<AdminActivityDto> {
    const db = this.database.db;
    const currencies = await db
      .selectFrom('app.organizations')
      .select([
        'default_currency',
        (eb) => eb.fn.countAll<string>().as('shops'),
      ])
      .where('status', '=', 'active')
      .groupBy('default_currency')
      .orderBy(sql`count(*)`, 'desc')
      .orderBy('default_currency')
      .execute();
    // Without any shop, the currency new shops get by default.
    const currency = currencies[0]?.default_currency ?? 'XOF';
    const [days, selling, months, top] = await Promise.all([
      sql<{ day: string; sales: string; amount: string }>`
        select d::date::text as day, count(x.id) as sales, coalesce(sum(x.total), 0) as amount
          from generate_series((now() at time zone 'UTC')::date - 29, (now() at time zone 'UTC')::date,
                               interval '1 day') as d
          left join (
            select s.id, s.total, s.occurred_at
              from app.sales s join app.organizations o on o.id = s.organization_id
             where s.status = 'completed' and o.default_currency = ${currency}
               and s.occurred_at >= now() - interval '31 days'
          ) x on (x.occurred_at at time zone 'UTC')::date = d::date
         group by d order by d`.execute(db),
      sql<{ week: string; month: string }>`
        select count(distinct organization_id) filter (where occurred_at >= now() - interval '7 days') as week,
               count(distinct organization_id) as month
          from app.sales
         where status = 'completed' and occurred_at >= now() - interval '30 days'`.execute(
        db,
      ),
      sql<{ month: string; shops: string; users: string }>`
        select to_char(m, 'YYYY-MM') as month,
               (select count(*) from app.organizations o
                 where o.created_at >= m at time zone 'UTC'
                   and o.created_at < (m + interval '1 month') at time zone 'UTC') as shops,
               (select count(*) from app.user_profiles u
                 where u.created_at >= m at time zone 'UTC'
                   and u.created_at < (m + interval '1 month') at time zone 'UTC') as users
          from generate_series(date_trunc('month', now() at time zone 'UTC') - interval '11 months',
                               date_trunc('month', now() at time zone 'UTC'), interval '1 month') as m
         order by m`.execute(db),
      sql<{ id: string; name: string; sales: string; amount: string }>`
        select o.id, o.name, count(*) as sales, sum(s.total) as amount
          from app.sales s join app.organizations o on o.id = s.organization_id
         where s.status = 'completed' and o.default_currency = ${currency}
           and s.occurred_at >= now() - interval '30 days'
         group by o.id, o.name
         order by sum(s.total) desc, o.name
         limit 5`.execute(db),
    ]);
    return {
      currency,
      otherCurrencyShops: currencies
        .slice(1)
        .reduce((sum, c) => sum + toNumber(c.shops), 0),
      days: days.rows.map((d) => ({
        day: d.day,
        sales: toNumber(d.sales),
        amount: toNumber(d.amount),
      })),
      shopsSelling: {
        last7Days: toNumber(selling.rows[0]!.week),
        last30Days: toNumber(selling.rows[0]!.month),
      },
      months: months.rows.map((m) => ({
        month: m.month,
        newShops: toNumber(m.shops),
        newUsers: toNumber(m.users),
      })),
      topShops: top.rows.map((t) => ({
        id: t.id,
        name: t.name,
        sales: toNumber(t.sales),
        amount: toNumber(t.amount),
      })),
    };
  }

  async sync(days: number): Promise<AdminSyncDto> {
    const db = this.database.db;
    const settings = await this.settings(db);
    const [perDay, reasons, silent] = await Promise.all([
      sql<{
        day: string;
        batches: string;
        accepted: string;
        duplicates: string;
        rejected: string;
      }>`
        select d.day::date::text as day, count(b.id) as batches,
               coalesce(sum(b.accepted), 0) as accepted, coalesce(sum(b.duplicates), 0) as duplicates,
               coalesce(sum(b.rejected), 0) as rejected
          from generate_series((now() at time zone 'UTC')::date - ${days - 1}::int, (now() at time zone 'UTC')::date, interval '1 day') as d(day)
          left join app.sync_batches b on (b.received_at at time zone 'UTC')::date = d.day::date
         group by d.day order by d.day`.execute(db),
      sql<{ code: string; count: string; example: string }>`
        select code, count(*) as count, min(message) as example
          from app.sync_rejections
         where created_at > now() - make_interval(days => ${days}::int)
         group by code order by count(*) desc limit 10`.execute(db),
      this.silentDevices(db, settings.silent_device_days),
    ]);
    return {
      days: perDay.rows.map((d) => ({
        day: d.day,
        batches: toNumber(d.batches),
        accepted: toNumber(d.accepted),
        duplicates: toNumber(d.duplicates),
        rejected: toNumber(d.rejected),
      })),
      reasons: reasons.rows.map((r) => ({
        code: r.code,
        count: toNumber(r.count),
        example: r.example,
      })),
      silentDevices: silent,
    };
  }

  /** Devices still allowed that sent nothing for `days` days. */
  private async silentDevices(executor: Executor, days: number) {
    const rows = await executor
      .selectFrom('app.devices as d')
      .innerJoin('app.organizations as o', 'o.id', 'd.organization_id')
      .select([
        'o.id as shop_id',
        'o.name as shop_name',
        'd.label',
        'd.last_synced_at',
      ])
      .where('d.revoked_at', 'is', null)
      .where('o.status', '=', 'active')
      .where(
        sql<boolean>`coalesce(d.last_synced_at, d.created_at) < now() - make_interval(days => ${days}::int)`,
      )
      .orderBy(sql`coalesce(d.last_synced_at, d.created_at)`)
      .limit(50)
      .execute();
    return rows.map((r) => ({
      shop: { id: r.shop_id, name: r.shop_name },
      label: r.label,
      lastSyncedAt: r.last_synced_at ? r.last_synced_at.toISOString() : null,
    }));
  }

  async overview(): Promise<AdminOverviewDto> {
    const db = this.database.db;
    const settings = await this.settings(db);
    const [shops, byPlan, users, pending, sync, perShopSync, quotas, silent] =
      await Promise.all([
        sql<{ active: string; suspended: string; recent: string }>`
        select count(*) filter (where status = 'active') as active,
               count(*) filter (where status = 'suspended') as suspended,
               count(*) filter (where created_at > now() - interval '30 days') as recent
          from app.organizations`.execute(db),
        db
          .selectFrom('app.plans as p')
          .leftJoin('app.subscriptions as s', 's.plan_key', 'p.key')
          .select([
            'p.key',
            'p.name',
            (eb) => eb.fn.count<string>('s.organization_id').as('count'),
          ])
          .groupBy(['p.key', 'p.name', 'p.position'])
          .orderBy('p.position')
          .execute(),
        sql<{ total: string; recent: string }>`
        select count(*) as total, count(*) filter (where created_at > now() - interval '30 days') as recent
          from app.user_profiles`.execute(db),
        sql<{
          count: string;
        }>`select count(*) as count from app.plan_change_requests where status = 'pending'`.execute(
          db,
        ),
        sql<{ batches: string; accepted: string; rejected: string }>`
        select count(*) as batches, coalesce(sum(accepted), 0) as accepted, coalesce(sum(rejected), 0) as rejected
          from app.sync_batches where received_at > now() - interval '7 days'`.execute(
          db,
        ),
        sql<{ id: string; name: string; accepted: string; rejected: string }>`
        select o.id, o.name, sum(b.accepted) as accepted, sum(b.rejected) as rejected
          from app.sync_batches b join app.organizations o on o.id = b.organization_id
         where b.received_at > now() - interval '7 days'
         group by o.id, o.name
        having sum(b.rejected) > 0`.execute(db),
        sql<{
          id: string;
          name: string;
          products: string;
          members: string;
          devices: string;
          max_products: number | null;
          max_members: number;
          max_devices: number;
        }>`
        select o.id, o.name, o.max_products, o.max_members, o.max_devices,
               (select count(*) from app.products x where x.organization_id = o.id and x.status = 'active') as products,
               (select count(*) from app.organization_memberships x where x.organization_id = o.id and x.status = 'active') as members,
               (select count(*) from app.devices x where x.organization_id = o.id and x.revoked_at is null) as devices
          from app.organizations o where o.status = 'active'`.execute(db),
        this.silentDevices(db, settings.silent_device_days),
      ]);

    const alerts: AdminAlertDto[] = [];
    const pendingCount = toNumber(pending.rows[0]!.count);
    if (pendingCount > 0)
      alerts.push({
        kind: 'plan_request',
        message: `${pendingCount} demande${pendingCount > 1 ? 's' : ''} de changement d’offre en attente.`,
        shop: null,
      });
    for (const s of perShopSync.rows) {
      const rejected = toNumber(s.rejected);
      const share = shareBasisPoints(rejected, rejected + toNumber(s.accepted));
      if (share >= settings.rejection_alert_basis_points)
        alerts.push({
          kind: 'sync_rejections',
          message: `${Math.round(share / 100)} % des opérations hors ligne refusées sur 7 jours (${rejected}).`,
          shop: { id: s.id, name: s.name },
        });
    }
    const quotaLabels = [
      ['products', 'max_products', 'produits'],
      ['members', 'max_members', 'personnes'],
      ['devices', 'max_devices', 'téléphones de caisse'],
    ] as const;
    for (const q of quotas.rows)
      for (const [used, max, label] of quotaLabels) {
        const n = toNumber(q[used]);
        const limit = q[max];
        if (limit === null) continue; // no limit, nothing to watch
        if (shareBasisPoints(n, limit) >= settings.quota_alert_basis_points)
          alerts.push({
            kind: 'quota',
            message: `${n} ${label} sur ${limit} permis par l’offre.`,
            shop: { id: q.id, name: q.name },
          });
      }
    for (const d of silent)
      alerts.push({
        kind: 'silent_device',
        message: d.lastSyncedAt
          ? `Le téléphone « ${d.label} » n’a rien envoyé depuis le ${d.lastSyncedAt.slice(0, 10).split('-').reverse().join('/')}.`
          : `Le téléphone « ${d.label} » n’a jamais rien envoyé.`,
        shop: d.shop,
      });

    const s = sync.rows[0]!;
    const accepted = toNumber(s.accepted);
    const rejected = toNumber(s.rejected);
    return {
      shops: {
        active: toNumber(shops.rows[0]!.active),
        suspended: toNumber(shops.rows[0]!.suspended),
        createdLast30Days: toNumber(shops.rows[0]!.recent),
        byPlan: byPlan.map((p) => ({
          key: p.key,
          name: p.name,
          count: toNumber(p.count),
        })),
      },
      users: {
        total: toNumber(users.rows[0]!.total),
        createdLast30Days: toNumber(users.rows[0]!.recent),
      },
      pendingRequests: pendingCount,
      sync: {
        batches: toNumber(s.batches),
        accepted,
        rejected,
        rejectionBasisPoints: shareBasisPoints(rejected, accepted + rejected),
      },
      alerts,
    };
  }
}
