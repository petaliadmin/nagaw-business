import { Injectable } from '@nestjs/common';
import {
  NOTIFICATION_CATEGORY_RULES,
  notificationCategoriesFor,
  type ListNotificationsQuery,
  type NotificationCategory,
  type NotificationDto,
  type NotificationListDto,
  type NotificationPreferenceDto,
  type NotificationSettingsDto,
  type NotificationSeverity,
  type UpdateNotificationPreferencesInput,
  type UpdateNotificationSettingsInput,
} from '@nagaw/shared';
import { sql } from 'kysely';
import { AuditService } from '../audit/audit.service.js';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { invalid, toNumber, type Executor } from '../catalog/catalog.errors.js';
import { DatabaseService } from '../database/database.service.js';
import { PushService } from './push.service.js';
import { moreSevere, recipientsFor } from './rules.js';

/** What happened, as told to the people concerned (ADR-036). */
export interface NotificationEvent {
  organizationId: string;
  category: NotificationCategory;
  kind: string;
  severity?: NotificationSeverity;
  title: string;
  body?: string;
  link?: string | null;
  /** While unread, a notification of the same group is updated in place. */
  groupKey: string;
  data?: Record<string, unknown>;
  /** The person who acted is not told what they just did. */
  exceptUserId?: string | null;
  /** Only these people (still within their rights and choices). */
  onlyUserIds?: readonly string[];
  /**
   * For a group: the new text from the data of the unread notification
   * (`null` when there is none yet).
   */
  merge?: (previous: Record<string, unknown> | null) => {
    title: string;
    body: string;
    data: Record<string, unknown>;
  };
}

const PAGE = 30;

/** Keyset cursor: `updated_at|id`. */
function decodeCursor(cursor: string): { at: Date; id: string } | null {
  const [at, id] = cursor.split('|');
  const date = at ? new Date(at) : null;
  if (
    !date ||
    Number.isNaN(date.getTime()) ||
    !id ||
    !/^[0-9a-f-]{36}$/i.test(id)
  )
    return null;
  return { at: date, id };
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
    private readonly push: PushService,
  ) {}

  // -------------------------------------------------------------------------
  // Writing (inside the transaction of what happened)
  // -------------------------------------------------------------------------

  /**
   * Addresses the event to the right people, in the caller's transaction:
   * the notification exists exactly when what it tells happened. Returns
   * the number of people notified.
   */
  async notify(trx: Executor, event: NotificationEvent): Promise<number> {
    const [members, preferences] = await Promise.all([
      trx
        .selectFrom('app.organization_memberships')
        .select(['user_id', 'role'])
        .where('organization_id', '=', event.organizationId)
        .where('status', '=', 'active')
        .execute(),
      trx
        .selectFrom('app.notification_preferences')
        .select(['user_id', 'category', 'enabled', 'push'])
        .where('organization_id', '=', event.organizationId)
        .where('category', '=', event.category)
        .execute(),
    ]);
    const recipients = recipientsFor(
      event.category,
      members.map((m) => ({ userId: m.user_id, role: m.role })),
      preferences.map((p) => ({
        userId: p.user_id,
        category: p.category,
        enabled: p.enabled,
        push: p.push,
      })),
      { exceptUserId: event.exceptUserId, onlyUserIds: event.onlyUserIds },
    );
    const severity = event.severity ?? 'info';
    const pushable = this.push.enabled;

    for (const recipient of recipients) {
      const open = await trx
        .selectFrom('app.notifications')
        .select(['id', 'data', 'severity'])
        .where('organization_id', '=', event.organizationId)
        .where('recipient_id', '=', recipient.userId)
        .where('group_key', '=', event.groupKey)
        .where('read_at', 'is', null)
        .forUpdate()
        .executeTakeFirst();
      const text = event.merge
        ? event.merge(open ? open.data : null)
        : {
            title: event.title,
            body: event.body ?? '',
            data: event.data ?? {},
          };
      const pushStatus = recipient.push && pushable ? 'pending' : 'none';

      if (open) {
        await trx
          .updateTable('app.notifications')
          .set({
            title: text.title.slice(0, 160),
            body: text.body.slice(0, 1000),
            data: JSON.stringify(text.data),
            severity: moreSevere(severity, open.severity)
              ? severity
              : open.severity,
            occurrences: sql<number>`occurrences + 1`,
            // A group already on the phone rings again only when it gets
            // worse (low stock → out of stock).
            ...(moreSevere(severity, open.severity)
              ? { push_status: pushStatus }
              : {}),
          })
          .where('id', '=', open.id)
          .execute();
        continue;
      }
      await trx
        .insertInto('app.notifications')
        .values({
          organization_id: event.organizationId,
          recipient_id: recipient.userId,
          category: event.category,
          kind: event.kind,
          severity,
          title: text.title.slice(0, 160),
          body: text.body.slice(0, 1000),
          link: event.link ?? null,
          group_key: event.groupKey,
          data: JSON.stringify(text.data),
          push_status: pushStatus,
        })
        .execute();
    }
    return recipients.length;
  }

  // -------------------------------------------------------------------------
  // Reading
  // -------------------------------------------------------------------------

  async list(
    tenant: TenantContext,
    user: AuthContext,
    query: ListNotificationsQuery,
  ): Promise<NotificationListDto> {
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;
    if (query.cursor && !cursor) throw invalid('cursor', 'Curseur invalide.');
    let items = this.database.db
      .selectFrom('app.notifications')
      .selectAll()
      .where('organization_id', '=', tenant.organizationId)
      .where('recipient_id', '=', user.userId)
      .orderBy('updated_at', 'desc')
      .orderBy('id', 'desc')
      .limit(PAGE + 1);
    if (query.unread) items = items.where('read_at', 'is', null);
    if (cursor)
      items = items.where((eb) =>
        eb.or([
          eb('updated_at', '<', cursor.at),
          eb.and([eb('updated_at', '=', cursor.at), eb('id', '<', cursor.id)]),
        ]),
      );
    const [rows, unread] = await Promise.all([
      items.execute(),
      this.unreadCount(tenant, user),
    ]);
    const page = rows.slice(0, PAGE);
    const last = page.at(-1);
    return {
      items: page.map((row): NotificationDto => ({
        id: row.id,
        category: row.category,
        kind: row.kind,
        severity: row.severity,
        title: row.title,
        body: row.body,
        link: row.link,
        occurrences: row.occurrences,
        read: row.read_at !== null,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
      })),
      unread,
      nextCursor:
        rows.length > PAGE && last
          ? `${last.updated_at.toISOString()}|${last.id}`
          : null,
    };
  }

  async unreadCount(tenant: TenantContext, user: AuthContext): Promise<number> {
    const row = await this.database.db
      .selectFrom('app.notifications')
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .where('organization_id', '=', tenant.organizationId)
      .where('recipient_id', '=', user.userId)
      .where('read_at', 'is', null)
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }

  /** Marks the person's own notifications as read; others' are untouched. */
  async markRead(
    tenant: TenantContext,
    user: AuthContext,
    ids: readonly string[] | undefined,
  ): Promise<{ unread: number }> {
    let update = this.database.db
      .updateTable('app.notifications')
      .set({ read_at: new Date() })
      .where('organization_id', '=', tenant.organizationId)
      .where('recipient_id', '=', user.userId)
      .where('read_at', 'is', null);
    if (ids) update = update.where('id', 'in', [...ids]);
    await update.execute();
    return { unread: await this.unreadCount(tenant, user) };
  }

  // -------------------------------------------------------------------------
  // Preferences
  // -------------------------------------------------------------------------

  async preferences(
    tenant: TenantContext,
    user: AuthContext,
  ): Promise<NotificationPreferenceDto[]> {
    const rows = await this.database.db
      .selectFrom('app.notification_preferences')
      .select(['category', 'enabled', 'push'])
      .where('organization_id', '=', tenant.organizationId)
      .where('user_id', '=', user.userId)
      .execute();
    return notificationCategoriesFor(tenant.role).map((category) => {
      const row = rows.find((r) => r.category === category);
      return row
        ? { category, enabled: row.enabled, push: row.push }
        : {
            category,
            enabled: NOTIFICATION_CATEGORY_RULES[
              category
            ].defaultRoles.includes(tenant.role),
            push: true,
          };
    });
  }

  async updatePreferences(
    tenant: TenantContext,
    user: AuthContext,
    input: UpdateNotificationPreferencesInput,
  ): Promise<NotificationPreferenceDto[]> {
    const allowed = notificationCategoriesFor(tenant.role);
    input.preferences.forEach((preference, index) => {
      if (!allowed.includes(preference.category))
        throw invalid(
          `preferences.${index}.category`,
          'Votre rôle ne reçoit pas ces notifications.',
        );
    });
    await this.database.db
      .insertInto('app.notification_preferences')
      .values(
        input.preferences.map((p) => ({
          organization_id: tenant.organizationId,
          user_id: user.userId,
          category: p.category,
          enabled: p.enabled,
          push: p.push,
        })),
      )
      .onConflict((oc) =>
        oc.columns(['organization_id', 'user_id', 'category']).doUpdateSet({
          enabled: (eb) => eb.ref('excluded.enabled'),
          push: (eb) => eb.ref('excluded.push'),
        }),
      )
      .execute();
    return this.preferences(tenant, user);
  }

  // -------------------------------------------------------------------------
  // Shop thresholds
  // -------------------------------------------------------------------------

  async settings(organizationId: string): Promise<NotificationSettingsDto> {
    const row = await this.database.db
      .selectFrom('app.organizations')
      .select([
        'seller_stock_correction_max',
        'stock_forecast_days',
        'stock_forecast_window_days',
        'credit_overdue_days',
        'credit_near_limit_percent',
        'daily_summary_hour',
        'seller_can_sell_below_cost',
      ])
      .where('id', '=', organizationId)
      .executeTakeFirstOrThrow();
    return {
      sellerStockCorrectionMax: toNumber(row.seller_stock_correction_max),
      stockForecastDays: row.stock_forecast_days,
      stockForecastWindowDays: row.stock_forecast_window_days,
      creditOverdueDays: row.credit_overdue_days,
      creditNearLimitPercent: row.credit_near_limit_percent,
      dailySummaryHour: row.daily_summary_hour,
      sellerCanSellBelowCost: row.seller_can_sell_below_cost,
    };
  }

  async updateSettings(
    tenant: TenantContext,
    user: AuthContext,
    input: UpdateNotificationSettingsInput,
    requestId: string | null,
  ): Promise<NotificationSettingsDto> {
    if (
      input.sellerStockCorrectionMax !== undefined &&
      Math.abs(
        input.sellerStockCorrectionMax * 1000 -
          Math.round(input.sellerStockCorrectionMax * 1000),
      ) > 1e-6
    )
      throw invalid('sellerStockCorrectionMax', 'Trois décimales au plus.');
    await this.database.db.transaction().execute(async (trx) => {
      await trx
        .updateTable('app.organizations')
        .set({
          ...(input.sellerStockCorrectionMax !== undefined && {
            seller_stock_correction_max: input.sellerStockCorrectionMax,
          }),
          ...(input.stockForecastDays !== undefined && {
            stock_forecast_days: input.stockForecastDays,
          }),
          ...(input.stockForecastWindowDays !== undefined && {
            stock_forecast_window_days: input.stockForecastWindowDays,
          }),
          ...(input.creditOverdueDays !== undefined && {
            credit_overdue_days: input.creditOverdueDays,
          }),
          ...(input.creditNearLimitPercent !== undefined && {
            credit_near_limit_percent: input.creditNearLimitPercent,
          }),
          ...(input.dailySummaryHour !== undefined && {
            daily_summary_hour: input.dailySummaryHour,
          }),
          ...(input.sellerCanSellBelowCost !== undefined && {
            seller_can_sell_below_cost: input.sellerCanSellBelowCost,
          }),
        })
        .where('id', '=', tenant.organizationId)
        .execute();
      await this.audit.record(trx, {
        organizationId: tenant.organizationId,
        actorType: 'user',
        actorId: user.userId,
        action: 'notification_settings.updated',
        targetType: 'organization',
        targetId: tenant.organizationId,
        metadata: { ...input },
        requestId,
      });
    });
    return this.settings(tenant.organizationId);
  }
}
