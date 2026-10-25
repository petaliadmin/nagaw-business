import { HttpStatus, Injectable } from '@nestjs/common';
import type { PlanDto, SubscriptionDto } from '@nagaw/shared';
import type { Selectable } from 'kysely';
import { AuditService } from '../audit/audit.service.js';
import {
  conflict,
  invalid,
  toNumber,
  type Executor,
} from '../catalog/catalog.errors.js';
import { ApiException } from '../common/api-exception.js';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { DatabaseService } from '../database/database.service.js';
import { pgErrorCode, UNIQUE_VIOLATION } from '../database/pg-errors.js';
import type { PlansTable } from '../database/schema.js';

function toPlanDto(row: Selectable<PlansTable>): PlanDto {
  return {
    key: row.key,
    name: row.name,
    monthlyPrice: toNumber(row.monthly_price),
    currency: row.currency,
    limits: {
      products: row.max_products,
      members: row.max_members,
      devices: row.max_devices,
    },
  };
}

/**
 * Offers and subscriptions (ADR-029). The offer's limits are the shop's
 * caps (copied by a database trigger); a change of offer is asked here and
 * made by the platform until a payment provider is chosen.
 */
@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  async plans(): Promise<PlanDto[]> {
    const rows = await this.database.db
      .selectFrom('app.plans')
      .selectAll()
      .orderBy('position')
      .execute();
    return rows.map(toPlanDto);
  }

  private async plan(executor: Executor, key: string) {
    const row = await executor
      .selectFrom('app.plans')
      .selectAll()
      .where('key', '=', key)
      .executeTakeFirst();
    return row ? toPlanDto(row) : null;
  }

  private async count(
    executor: Executor,
    table: 'app.products' | 'app.organization_memberships' | 'app.devices',
    organizationId: string,
  ): Promise<number> {
    let query = executor
      .selectFrom(table)
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .where('organization_id', '=', organizationId);
    if (table === 'app.devices') query = query.where('revoked_at', 'is', null);
    else query = query.where('status', '=', 'active');
    return toNumber((await query.executeTakeFirstOrThrow()).count);
  }

  async subscription(
    organizationId: string,
    executor: Executor = this.database.db,
  ): Promise<SubscriptionDto> {
    const [subscription, org, products, members, devices, pending] =
      await Promise.all([
        executor
          .selectFrom('app.subscriptions')
          .select(['plan_key', 'started_at'])
          .where('organization_id', '=', organizationId)
          .executeTakeFirstOrThrow(),
        executor
          .selectFrom('app.organizations')
          .select(['max_products', 'max_members', 'max_devices'])
          .where('id', '=', organizationId)
          .executeTakeFirstOrThrow(),
        this.count(executor, 'app.products', organizationId),
        this.count(executor, 'app.organization_memberships', organizationId),
        this.count(executor, 'app.devices', organizationId),
        executor
          .selectFrom('app.plan_change_requests')
          .select(['id', 'plan_key', 'created_at'])
          .where('organization_id', '=', organizationId)
          .where('status', '=', 'pending')
          .executeTakeFirst(),
      ]);
    const plan = await this.plan(executor, subscription.plan_key);
    if (!plan)
      throw new Error(`Subscription to unknown plan ${subscription.plan_key}`);
    const pendingPlan = pending
      ? await this.plan(executor, pending.plan_key)
      : null;
    return {
      plan,
      startedAt: subscription.started_at.toISOString(),
      usage: { products, members, devices },
      limits: {
        products: org.max_products,
        members: org.max_members,
        devices: org.max_devices,
      },
      pendingRequest:
        pending && pendingPlan
          ? {
              id: pending.id,
              plan: pendingPlan,
              createdAt: pending.created_at.toISOString(),
            }
          : null,
    };
  }

  async requestChange(
    tenant: TenantContext,
    user: AuthContext,
    planKey: string,
    requestId: string | null,
  ): Promise<SubscriptionDto> {
    try {
      return await this.database.db.transaction().execute(async (trx) => {
        const plan = await this.plan(trx, planKey);
        if (!plan) throw invalid('planKey', 'Offre inconnue.');
        // Serializes the requests of a shop. The subscription itself is not
        // locked: the API may not change it (only the platform does).
        await trx
          .selectFrom('app.organizations')
          .select('id')
          .where('id', '=', tenant.organizationId)
          .forUpdate()
          .executeTakeFirstOrThrow();
        const current = await trx
          .selectFrom('app.subscriptions')
          .select('plan_key')
          .where('organization_id', '=', tenant.organizationId)
          .executeTakeFirstOrThrow();
        if (current.plan_key === plan.key)
          throw conflict(
            'ALREADY_ON_PLAN',
            `La boutique est déjà sur l’offre ${plan.name}.`,
          );
        const { id } = await trx
          .insertInto('app.plan_change_requests')
          .values({
            organization_id: tenant.organizationId,
            plan_key: plan.key,
            requested_by: user.userId,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        await this.audit.record(trx, {
          organizationId: tenant.organizationId,
          actorType: 'user',
          actorId: user.userId,
          action: 'subscription.change_requested',
          targetType: 'plan_change_request',
          targetId: id,
          metadata: { from: current.plan_key, to: plan.key },
          requestId,
        });
        return this.subscription(tenant.organizationId, trx);
      });
    } catch (error) {
      if (pgErrorCode(error) === UNIQUE_VIOLATION)
        throw new ApiException(
          HttpStatus.CONFLICT,
          'PLAN_CHANGE_PENDING',
          'Une demande de changement d’offre est déjà en cours : annulez-la pour en faire une autre.',
        );
      throw error;
    }
  }

  async cancelRequest(
    tenant: TenantContext,
    user: AuthContext,
    requestId: string | null,
  ): Promise<SubscriptionDto> {
    return this.database.db.transaction().execute(async (trx) => {
      const pending = await trx
        .selectFrom('app.plan_change_requests')
        .select(['id', 'plan_key'])
        .where('organization_id', '=', tenant.organizationId)
        .where('status', '=', 'pending')
        .forUpdate()
        .executeTakeFirst();
      if (!pending)
        throw conflict(
          'NO_PENDING_REQUEST',
          'Aucune demande de changement d’offre en cours.',
        );
      await trx
        .updateTable('app.plan_change_requests')
        .set({
          status: 'cancelled',
          resolved_at: new Date(),
          resolved_by: user.userId,
        })
        .where('id', '=', pending.id)
        .execute();
      await this.audit.record(trx, {
        organizationId: tenant.organizationId,
        actorType: 'user',
        actorId: user.userId,
        action: 'subscription.change_cancelled',
        targetType: 'plan_change_request',
        targetId: pending.id,
        metadata: { to: pending.plan_key },
        requestId,
      });
      return this.subscription(tenant.organizationId, trx);
    });
  }
}
