import { Injectable } from '@nestjs/common';
import {
  shareBasisPoints,
  type AdminAlertDto,
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
 * shops; never their products, sales or customers. Every change is audited
 * in the shop's own history, as done by the platform.
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
    const rows = await q.orderBy('o.created_at', 'desc').limit(200).execute();
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
    };
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
      return this.shop(id, trx);
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
      return this.shop(id, trx);
    });
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
