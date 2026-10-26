import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  PushPayload,
  PushSubscriptionInput,
  RemovePushSubscriptionInput,
} from '@nagaw/shared';
import { sql } from 'kysely';
import webpush from 'web-push';
import type { AuthContext } from '../common/request-context.js';
import { ENV, type Env } from '../config/env.js';
import { DatabaseService } from '../database/database.service.js';

/** Messages sent per call, so that a request never waits long. */
const BATCH = 50;
/** A phone that failed this many times in a row is switched off. */
const MAX_FAILURES = 5;
/** Time allowed to each push service. */
const SEND_TIMEOUT_MS = 4000;

/** Push services answer 404/410 for a browser that unsubscribed. */
function isGone(error: unknown): boolean {
  const status = (error as { statusCode?: number } | null)?.statusCode;
  return status === 404 || status === 410;
}

/**
 * Web Push (ADR-036): the notification rows marked `pending` are sent to
 * the browsers of their recipient, after the transaction that created them
 * has committed. Without VAPID keys, nothing is sent and nothing is marked
 * pending: notifications stay in the application.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly vapid: {
    subject: string;
    publicKey: string;
    privateKey: string;
  } | null;

  constructor(
    private readonly database: DatabaseService,
    @Inject(ENV) env: Env,
  ) {
    this.vapid =
      env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT
        ? {
            subject: env.VAPID_SUBJECT,
            publicKey: env.VAPID_PUBLIC_KEY,
            privateKey: env.VAPID_PRIVATE_KEY,
          }
        : null;
  }

  get enabled(): boolean {
    return this.vapid !== null;
  }

  get publicKey(): string | null {
    return this.vapid?.publicKey ?? null;
  }

  /** Registers this browser for the person (it may have been someone else's). */
  async subscribe(
    user: AuthContext,
    input: PushSubscriptionInput,
  ): Promise<void> {
    await this.database.db
      .insertInto('app.push_subscriptions')
      .values({
        user_id: user.userId,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        label: input.label,
      })
      .onConflict((oc) =>
        oc.column('endpoint').doUpdateSet({
          user_id: user.userId,
          p256dh: input.keys.p256dh,
          auth: input.keys.auth,
          label: input.label,
          failure_count: 0,
          disabled_at: null,
        }),
      )
      .execute();
  }

  /** Switches off this browser, only if it is the person's own. */
  async unsubscribe(
    user: AuthContext,
    input: RemovePushSubscriptionInput,
  ): Promise<void> {
    await this.database.db
      .updateTable('app.push_subscriptions')
      .set({ disabled_at: new Date() })
      .where('endpoint', '=', input.endpoint)
      .where('user_id', '=', user.userId)
      .where('disabled_at', 'is', null)
      .execute();
  }

  /**
   * Sends the pending messages, oldest first. Each row is claimed before
   * sending (SKIP LOCKED): two calls never send the same message twice.
   * Errors are logged and kept on the row, never thrown to the caller,
   * whose work is already committed.
   */
  async dispatchPending(
    organizationId?: string,
  ): Promise<{ sent: number; failed: number }> {
    if (!this.vapid) return { sent: 0, failed: 0 };
    const vapid = this.vapid;
    let claimed: {
      id: string;
      recipient_id: string;
      title: string;
      body: string;
      link: string | null;
      group_key: string;
      organization_id: string;
      shop: string;
    }[];
    try {
      claimed = await this.database.db.transaction().execute(async (trx) => {
        let pending = trx
          .selectFrom('app.notifications')
          .select('id')
          .where('push_status', '=', 'pending')
          .orderBy('created_at')
          .limit(BATCH)
          .forUpdate()
          .skipLocked();
        if (organizationId)
          pending = pending.where('organization_id', '=', organizationId);
        const ids = (await pending.execute()).map((r) => r.id);
        if (ids.length === 0) return [];
        await trx
          .updateTable('app.notifications')
          .set({ push_status: 'sent' })
          .where('id', 'in', ids)
          .execute();
        return trx
          .selectFrom('app.notifications as n')
          .innerJoin('app.organizations as o', 'o.id', 'n.organization_id')
          .select([
            'n.id',
            'n.recipient_id',
            'n.title',
            'n.body',
            'n.link',
            'n.group_key',
            'n.organization_id',
            'o.name as shop',
          ])
          .where('n.id', 'in', ids)
          .execute();
      });
    } catch (error) {
      this.logger.error({ err: error }, 'Envoi des notifications impossible');
      return { sent: 0, failed: 0 };
    }
    if (claimed.length === 0) return { sent: 0, failed: 0 };

    const subscriptions = await this.database.db
      .selectFrom('app.push_subscriptions')
      .select(['id', 'user_id', 'endpoint', 'p256dh', 'auth'])
      .where('user_id', 'in', [...new Set(claimed.map((n) => n.recipient_id))])
      .where('disabled_at', 'is', null)
      .execute();

    let sent = 0;
    let failed = 0;
    await Promise.all(
      claimed.map(async (notification) => {
        const targets = subscriptions.filter(
          (s) => s.user_id === notification.recipient_id,
        );
        const payload: PushPayload = {
          title: `${notification.shop} · ${notification.title}`.slice(0, 160),
          body: notification.body.slice(0, 300),
          tag: `${notification.organization_id}:${notification.group_key}`,
          url: notification.link ?? '/espace/notifications',
        };
        const results = await Promise.all(
          targets.map((target) => this.send(target, payload, vapid)),
        );
        const ok = results.some(Boolean);
        if (ok) sent += 1;
        else if (targets.length > 0) failed += 1;
        // No browser registered: nothing to send, the row says so.
        const status = ok ? 'sent' : targets.length === 0 ? 'none' : 'failed';
        if (status !== 'sent')
          await this.database.db
            .updateTable('app.notifications')
            .set({ push_status: status })
            .where('id', '=', notification.id)
            .execute();
      }),
    );
    return { sent, failed };
  }

  private async send(
    target: { id: string; endpoint: string; p256dh: string; auth: string },
    payload: PushPayload,
    vapid: { subject: string; publicKey: string; privateKey: string },
  ): Promise<boolean> {
    try {
      await webpush.sendNotification(
        {
          endpoint: target.endpoint,
          keys: { p256dh: target.p256dh, auth: target.auth },
        },
        JSON.stringify(payload),
        { vapidDetails: vapid, TTL: 24 * 60 * 60, timeout: SEND_TIMEOUT_MS },
      );
      await this.database.db
        .updateTable('app.push_subscriptions')
        .set({ failure_count: 0, last_success_at: new Date() })
        .where('id', '=', target.id)
        .execute();
      return true;
    } catch (error) {
      // The endpoint is a capability URL: only its host goes to the logs.
      this.logger.warn(
        {
          host: new URL(target.endpoint).host,
          statusCode: (error as { statusCode?: number }).statusCode,
        },
        'Notification push refusée',
      );
      await this.database.db
        .updateTable('app.push_subscriptions')
        .set({
          failure_count: sql<number>`failure_count + 1`,
          disabled_at: isGone(error)
            ? new Date()
            : sql<Date | null>`case when failure_count + 1 >= ${MAX_FAILURES} then now() else null end`,
        })
        .where('id', '=', target.id)
        .execute();
      return false;
    }
  }
}
