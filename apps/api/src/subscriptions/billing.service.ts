import { Injectable, Logger } from '@nestjs/common';
import {
  addPeriod,
  formatAmount,
  invoiceReference,
  type SubscriptionInvoiceDto,
  type SubscriptionPeriod,
} from '@nagaw/shared';
import { sql, type Selectable } from 'kysely';
import { AuditService } from '../audit/audit.service.js';
import {
  conflict,
  invalid,
  notFound,
  toNumber,
  UUID_RE,
  type Executor,
} from '../catalog/catalog.errors.js';
import { DatabaseService } from '../database/database.service.js';
import type {
  PlansTable,
  SubscriptionInvoicesTable,
} from '../database/schema.js';

/** Invoices shown with a subscription: the pending ones and the latest. */
const INVOICES_SHOWN = 12;

export const invoiceNotFound = () =>
  notFound('INVOICE_NOT_FOUND', 'Facture introuvable.');

export const yearlyPriceOf = (plan: Selectable<PlansTable>) =>
  plan.yearly_price === null
    ? toNumber(plan.monthly_price) * 12
    : toNumber(plan.yearly_price);

const priceOf = (plan: Selectable<PlansTable>, period: SubscriptionPeriod) =>
  period === 'year' ? yearlyPriceOf(plan) : toNumber(plan.monthly_price);

/** Who acts: the platform administrator, or the daily run (null). */
type Actor = { userId: string } | null;

/**
 * Terms and invoices of the subscriptions (ADR-073). A paid offer lasts one
 * month or one year. The platform extends it by hand once paid; renewed
 * automatically, an invoice is issued at the end of the term and the shop
 * is suspended if it is still unpaid after the platform's grace days. No
 * payment is taken here: the platform marks an invoice paid.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  toDto(
    row: Selectable<SubscriptionInvoicesTable>,
    planName: string,
  ): SubscriptionInvoiceDto {
    return {
      id: row.id,
      reference: invoiceReference(row.id),
      plan: { key: row.plan_key, name: planName },
      period: row.period,
      amount: toNumber(row.amount),
      currency: row.currency,
      periodStart: row.period_start.toISOString(),
      periodEnd: row.period_end.toISOString(),
      status: row.status,
      dueAt: row.due_at.toISOString(),
      paidAt: row.paid_at?.toISOString() ?? null,
      note: row.note,
      createdAt: row.created_at.toISOString(),
    };
  }

  async invoicesOf(
    executor: Executor,
    organizationId: string,
  ): Promise<SubscriptionInvoiceDto[]> {
    const rows = await executor
      .selectFrom('app.subscription_invoices as i')
      .innerJoin('app.plans as p', 'p.key', 'i.plan_key')
      .selectAll('i')
      .select('p.name as plan_name')
      .where('i.organization_id', '=', organizationId)
      .orderBy(sql`case i.status when 'pending' then 0 else 1 end`)
      .orderBy('i.period_start', 'desc')
      .limit(INVOICES_SHOWN)
      .execute();
    return rows.map((r) => this.toDto(r, r.plan_name));
  }

  private async plan(executor: Executor, key: string) {
    return executor
      .selectFrom('app.plans')
      .selectAll()
      .where('key', '=', key)
      .executeTakeFirstOrThrow();
  }

  private async graceDays(executor: Executor): Promise<number> {
    const row = await executor
      .selectFrom('app.platform_settings')
      .select('subscription_grace_days')
      .executeTakeFirst();
    return row?.subscription_grace_days ?? 15;
  }

  /** An invoice already paid (by hand) or to pay (renewal). */
  private async issue(
    trx: Executor,
    input: {
      organizationId: string;
      plan: Selectable<PlansTable>;
      period: SubscriptionPeriod;
      start: Date;
      end: Date;
      paidBy: Actor;
      dueAt: Date;
      note: string;
    },
  ): Promise<string> {
    const paid = input.paidBy !== null;
    const { id } = await trx
      .insertInto('app.subscription_invoices')
      .values({
        organization_id: input.organizationId,
        plan_key: input.plan.key,
        period: input.period,
        amount: priceOf(input.plan, input.period),
        currency: input.plan.currency,
        period_start: input.start,
        period_end: input.end,
        status: paid ? 'paid' : 'pending',
        due_at: input.dueAt,
        issued_by: input.paidBy?.userId ?? null,
        paid_at: paid ? new Date() : null,
        paid_by: input.paidBy?.userId ?? null,
        note: input.note,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return id;
  }

  /**
   * A new offer starts its term now (plan changed by the platform, payment
   * received): one month or one year, invoiced as paid. Free: no term.
   */
  async startTerm(
    trx: Executor,
    admin: { userId: string },
    organizationId: string,
    planKey: string,
    period: SubscriptionPeriod,
    note: string,
  ): Promise<void> {
    const plan = await this.plan(trx, planKey);
    const sub = await trx
      .selectFrom('app.subscriptions')
      .select(['lifetime'])
      .where('organization_id', '=', organizationId)
      .executeTakeFirstOrThrow();
    if (sub.lifetime) return;
    if (toNumber(plan.monthly_price) === 0) {
      await trx
        .updateTable('app.subscriptions')
        .set({ current_period_end: null, period: 'month' })
        .where('organization_id', '=', organizationId)
        .execute();
      return;
    }
    const start = new Date();
    const end = addPeriod(start, period);
    await this.issue(trx, {
      organizationId,
      plan,
      period,
      start,
      end,
      paidBy: admin,
      dueAt: start,
      note,
    });
    await trx
      .updateTable('app.subscriptions')
      .set({ current_period_end: end, period })
      .where('organization_id', '=', organizationId)
      .execute();
  }

  /** « Prolonger » by hand, payment received: from the end of the term. */
  async renew(
    trx: Executor,
    admin: { userId: string },
    organizationId: string,
    period: SubscriptionPeriod,
    note: string,
    requestId: string | null,
  ): Promise<void> {
    const sub = await trx
      .selectFrom('app.subscriptions')
      .select(['plan_key', 'current_period_end', 'lifetime'])
      .where('organization_id', '=', organizationId)
      .forUpdate()
      .executeTakeFirstOrThrow();
    if (sub.lifetime)
      throw conflict(
        'SUBSCRIPTION_LIFETIME',
        'Cet abonnement est à vie : il ne se prolonge pas.',
      );
    const plan = await this.plan(trx, sub.plan_key);
    if (toNumber(plan.monthly_price) === 0)
      throw conflict(
        'SUBSCRIPTION_FREE',
        'L’offre gratuite ne se prolonge pas : changez d’abord d’offre.',
      );
    const now = new Date();
    const start =
      sub.current_period_end && sub.current_period_end > now
        ? sub.current_period_end
        : now;
    const end = addPeriod(start, period);
    const invoiceId = await this.issue(trx, {
      organizationId,
      plan,
      period,
      start,
      end,
      paidBy: admin,
      dueAt: now,
      note,
    });
    await trx
      .updateTable('app.subscriptions')
      .set({ current_period_end: end, period })
      .where('organization_id', '=', organizationId)
      .execute();
    await this.audit.record(trx, {
      organizationId,
      actorType: 'platform_admin',
      actorId: admin.userId,
      action: 'subscription.renewed',
      targetType: 'subscription_invoice',
      targetId: invoiceId,
      metadata: { period, until: end.toISOString(), note },
      requestId,
    });
    await this.reopenIfSuspendedForUnpaid(
      trx,
      admin,
      organizationId,
      null,
      requestId,
    );
  }

  /** The shop opens again when what suspended it is settled. */
  private async reopenIfSuspendedForUnpaid(
    trx: Executor,
    admin: { userId: string },
    organizationId: string,
    invoiceId: string | null,
    requestId: string | null,
  ): Promise<void> {
    const shop = await trx
      .selectFrom('app.organizations')
      .select(['status', 'suspended_invoice_id'])
      .where('id', '=', organizationId)
      .executeTakeFirstOrThrow();
    if (shop.status !== 'suspended' || !shop.suspended_invoice_id) return;
    // Another invoice past due keeps the shop closed.
    const stillDue = await trx
      .selectFrom('app.subscription_invoices')
      .select('id')
      .where('organization_id', '=', organizationId)
      .where('status', '=', 'pending')
      .where('due_at', '<=', new Date())
      .executeTakeFirst();
    if (stillDue) return;
    await trx
      .updateTable('app.organizations')
      .set({
        status: 'active',
        suspended_at: null,
        suspension_reason: null,
        suspended_invoice_id: null,
      })
      .where('id', '=', organizationId)
      .execute();
    await this.audit.record(trx, {
      organizationId,
      actorType: 'platform_admin',
      actorId: admin.userId,
      action: 'organization.reactivated',
      targetType: 'organization',
      targetId: organizationId,
      metadata: { invoicePaid: true, ...(invoiceId ? { invoiceId } : {}) },
      requestId,
    });
  }

  /** The platform received the payment, or forgives the invoice. */
  async decide(
    admin: { userId: string },
    invoiceId: string,
    decision: 'paid' | 'cancelled',
    note: string,
    requestId: string | null,
  ): Promise<{ organizationId: string }> {
    if (!UUID_RE.test(invoiceId)) throw invoiceNotFound();
    return this.database.db.transaction().execute(async (trx) => {
      const invoice = await trx
        .selectFrom('app.subscription_invoices')
        .select(['id', 'organization_id', 'status', 'amount', 'currency'])
        .where('id', '=', invoiceId)
        .forUpdate()
        .executeTakeFirst();
      if (!invoice) throw invoiceNotFound();
      if (invoice.status !== 'pending')
        throw conflict(
          'INVOICE_NOT_PENDING',
          'Cette facture est déjà payée ou annulée.',
        );
      await trx
        .updateTable('app.subscription_invoices')
        .set(
          decision === 'paid'
            ? {
                status: 'paid',
                paid_at: new Date(),
                paid_by: admin.userId,
                note,
              }
            : { status: 'cancelled', note },
        )
        .where('id', '=', invoiceId)
        .execute();
      await this.audit.record(trx, {
        organizationId: invoice.organization_id,
        actorType: 'platform_admin',
        actorId: admin.userId,
        action:
          decision === 'paid'
            ? 'subscription.invoice_paid'
            : 'subscription.invoice_cancelled',
        targetType: 'subscription_invoice',
        targetId: invoiceId,
        metadata: {
          amount: toNumber(invoice.amount),
          currency: invoice.currency,
          ...(note ? { note } : {}),
        },
        requestId,
      });
      await this.reopenIfSuspendedForUnpaid(
        trx,
        admin,
        invoice.organization_id,
        invoiceId,
        requestId,
      );
      return { organizationId: invoice.organization_id };
    });
  }

  /**
   * The owner (or the platform) turns the automatic renewal on or off; the
   * platform administrator alone gives or takes the lifetime subscription.
   */
  async settings(
    trx: Executor,
    actor: { userId: string; platform: boolean },
    organizationId: string,
    input: { autoRenew?: boolean; lifetime?: boolean; note?: string },
    requestId: string | null,
  ): Promise<void> {
    const sub = await trx
      .selectFrom('app.subscriptions')
      .select([
        'plan_key',
        'auto_renew',
        'lifetime',
        'period',
        'current_period_end',
      ])
      .where('organization_id', '=', organizationId)
      .forUpdate()
      .executeTakeFirstOrThrow();
    const actorType = actor.platform ? 'platform_admin' : 'user';
    if (input.lifetime !== undefined && input.lifetime !== sub.lifetime) {
      if (!actor.platform)
        throw invalid(
          'lifetime',
          'Seule la plateforme accorde un abonnement à vie.',
        );
      const plan = await this.plan(trx, sub.plan_key);
      if (input.lifetime) {
        await trx
          .updateTable('app.subscriptions')
          .set({
            lifetime: true,
            lifetime_granted_by: actor.userId,
            lifetime_granted_at: new Date(),
            current_period_end: null,
            auto_renew: false,
          })
          .where('organization_id', '=', organizationId)
          .execute();
        // Nothing more to pay for this shop.
        await trx
          .updateTable('app.subscription_invoices')
          .set({ status: 'cancelled', note: 'Abonnement à vie' })
          .where('organization_id', '=', organizationId)
          .where('status', '=', 'pending')
          .execute();
      } else {
        const paid = toNumber(plan.monthly_price) > 0;
        await trx
          .updateTable('app.subscriptions')
          .set({
            lifetime: false,
            lifetime_granted_by: null,
            lifetime_granted_at: null,
            // Taken back: one term from today, then the usual rules.
            current_period_end: paid ? addPeriod(new Date(), sub.period) : null,
          })
          .where('organization_id', '=', organizationId)
          .execute();
      }
      await this.audit.record(trx, {
        organizationId,
        actorType,
        actorId: actor.userId,
        action: input.lifetime
          ? 'subscription.lifetime_granted'
          : 'subscription.lifetime_removed',
        targetType: 'organization',
        targetId: organizationId,
        metadata: {
          plan: sub.plan_key,
          ...(input.note ? { note: input.note } : {}),
        },
        requestId,
      });
      if (input.lifetime)
        await this.reopenIfSuspendedForUnpaid(
          trx,
          { userId: actor.userId },
          organizationId,
          null,
          requestId,
        );
    }
    if (input.autoRenew !== undefined && input.autoRenew !== sub.auto_renew) {
      const lifetime = input.lifetime ?? sub.lifetime;
      if (lifetime)
        throw conflict(
          'SUBSCRIPTION_LIFETIME',
          'Un abonnement à vie ne se renouvelle pas.',
        );
      await trx
        .updateTable('app.subscriptions')
        .set({ auto_renew: input.autoRenew })
        .where('organization_id', '=', organizationId)
        .execute();
      await this.audit.record(trx, {
        organizationId,
        actorType,
        actorId: actor.userId,
        action: 'subscription.auto_renew_changed',
        targetType: 'organization',
        targetId: organizationId,
        metadata: { autoRenew: input.autoRenew },
        requestId,
      });
    }
  }

  /**
   * The daily run (ADR-073): ends of term renewed (invoice to pay) or back
   * to the free offer; unpaid invoices past their grace suspend the shop.
   */
  async runDue(now = new Date()): Promise<{
    renewed: number;
    expired: number;
    suspended: number;
  }> {
    const db = this.database.db;
    const ended = await db
      .selectFrom('app.subscriptions as s')
      .innerJoin('app.organizations as o', 'o.id', 's.organization_id')
      .select(['s.organization_id'])
      .where('s.lifetime', '=', false)
      .where('s.current_period_end', 'is not', null)
      .where('s.current_period_end', '<=', now)
      .where('o.status', '=', 'active')
      .execute();
    let renewed = 0;
    let expired = 0;
    for (const { organization_id } of ended) {
      try {
        const result = await db
          .transaction()
          .execute((trx) => this.endTerm(trx, organization_id, now));
        if (result === 'renewed') renewed += 1;
        if (result === 'expired') expired += 1;
      } catch (error) {
        // One shop's failure never stops the others; it is tried tomorrow.
        this.logger.error(
          { err: error, organizationId: organization_id },
          'Fin d’abonnement non traitée',
        );
      }
    }

    const overdue = await db
      .selectFrom('app.subscription_invoices as i')
      .innerJoin('app.organizations as o', 'o.id', 'i.organization_id')
      .select([
        'i.id',
        'i.organization_id',
        'i.amount',
        'i.currency',
        'i.period_start',
      ])
      .where('i.status', '=', 'pending')
      .where('i.due_at', '<=', now)
      .where('o.status', '=', 'active')
      .execute();
    let suspended = 0;
    for (const invoice of overdue) {
      try {
        await db.transaction().execute(async (trx) => {
          const shop = await trx
            .selectFrom('app.organizations')
            .select('status')
            .where('id', '=', invoice.organization_id)
            .forUpdate()
            .executeTakeFirstOrThrow();
          if (shop.status !== 'active') return;
          const reason = `Abonnement impayé : facture ${invoiceReference(invoice.id)} de ${formatAmount(toNumber(invoice.amount), invoice.currency)}.`;
          await trx
            .updateTable('app.organizations')
            .set({
              status: 'suspended',
              suspended_at: now,
              suspension_reason: reason,
              suspended_invoice_id: invoice.id,
            })
            .where('id', '=', invoice.organization_id)
            .execute();
          await this.audit.record(trx, {
            organizationId: invoice.organization_id,
            actorType: 'system',
            actorId: null,
            action: 'organization.suspended',
            targetType: 'subscription_invoice',
            targetId: invoice.id,
            metadata: { reason, unpaidInvoice: true },
            requestId: null,
          });
          suspended += 1;
        });
      } catch (error) {
        this.logger.error(
          { err: error, invoiceId: invoice.id },
          'Suspension pour impayé non faite',
        );
      }
    }
    return { renewed, expired, suspended };
  }

  private async endTerm(
    trx: Executor,
    organizationId: string,
    now: Date,
  ): Promise<'renewed' | 'expired' | 'skipped'> {
    const sub = await trx
      .selectFrom('app.subscriptions')
      .select([
        'plan_key',
        'period',
        'current_period_end',
        'auto_renew',
        'lifetime',
      ])
      .where('organization_id', '=', organizationId)
      .forUpdate()
      .executeTakeFirstOrThrow();
    if (sub.lifetime || !sub.current_period_end || sub.current_period_end > now)
      return 'skipped';
    const plan = await this.plan(trx, sub.plan_key);
    if (sub.auto_renew && toNumber(plan.monthly_price) > 0) {
      const start = sub.current_period_end;
      const end = addPeriod(start, sub.period);
      const grace = await this.graceDays(trx);
      const invoiceId = await this.issue(trx, {
        organizationId,
        plan,
        period: sub.period,
        start,
        end,
        paidBy: null,
        dueAt: new Date(now.getTime() + grace * 24 * 60 * 60 * 1000),
        note: '',
      });
      await trx
        .updateTable('app.subscriptions')
        .set({ current_period_end: end })
        .where('organization_id', '=', organizationId)
        .execute();
      await this.audit.record(trx, {
        organizationId,
        actorType: 'system',
        actorId: null,
        action: 'subscription.invoice_issued',
        targetType: 'subscription_invoice',
        targetId: invoiceId,
        metadata: { period: sub.period, until: end.toISOString() },
        requestId: null,
      });
      return 'renewed';
    }
    // Not renewed: back to the free offer; nothing is deleted.
    const free = await trx
      .selectFrom('app.plans')
      .select('key')
      .where('monthly_price', '=', '0')
      .orderBy('position')
      .executeTakeFirstOrThrow();
    await trx
      .updateTable('app.subscriptions')
      .set({ plan_key: free.key, current_period_end: null, changed_by: null })
      .where('organization_id', '=', organizationId)
      .execute();
    await this.audit.record(trx, {
      organizationId,
      actorType: 'system',
      actorId: null,
      action: 'subscription.plan_changed',
      targetType: 'organization',
      targetId: organizationId,
      metadata: { from: sub.plan_key, to: free.key, expired: true },
      requestId: null,
    });
    return 'expired';
  }
}
