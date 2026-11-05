import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import {
  waveAmount,
  type ConnectWaveInput,
  type PublicOrderStatusDto,
  type WaveAccountDto,
  type WaveLaunchDto,
  type WaveState,
} from '@nagaw/shared';
import type { Selectable, Transaction } from 'kysely';
import { AuditService } from '../audit/audit.service.js';
import { toNumber } from '../catalog/catalog.errors.js';
import { ApiException } from '../common/api-exception.js';
import type { AuthContext } from '../common/request-context.js';
import { SecretBox } from '../common/secret-box.js';
import { ENV, type Env } from '../config/env.js';
import { DatabaseService } from '../database/database.service.js';
import type { Database, OrdersTable } from '../database/schema.js';
import {
  WAVE_CLIENT,
  type WaveClient,
  type WaveCredentials,
  type WaveSession,
} from './wave.client.js';
import { verifyWaveSignature } from './wave-signature.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A session closer to its end than this is not offered again. */
const SESSION_MARGIN_MS = 2 * 60 * 1000;

const orderNotFound = () =>
  new ApiException(
    HttpStatus.NOT_FOUND,
    'ORDER_NOT_FOUND',
    'Commande introuvable.',
  );

const notConnected = () =>
  new ApiException(
    HttpStatus.CONFLICT,
    'WAVE_NOT_CONNECTED',
    'Cette boutique ne prend pas Wave en ligne. Payez avec le numéro et la référence.',
  );

/**
 * Payment of an order by Wave (ADR-065). The money goes to the Wave account
 * of the shop. An order is marked paid only after Wave itself, asked with
 * the shop's key, says the session succeeded for the right amount: never on
 * the word of a browser, nor of a webhook body alone.
 */
@Injectable()
export class WaveService {
  private readonly logger = new Logger(WaveService.name);
  private readonly box: SecretBox | null;

  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
    @Inject(WAVE_CLIENT) private readonly wave: WaveClient,
    @Inject(ENV) private readonly env: Env,
  ) {
    this.box = env.CREDENTIALS_ENCRYPTION_KEY
      ? new SecretBox(env.CREDENTIALS_ENCRYPTION_KEY)
      : null;
  }

  private requireBox(): SecretBox {
    if (!this.box)
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'WAVE_NOT_AVAILABLE',
        'Le paiement Wave en ligne n’est pas encore ouvert sur Nagaw.',
      );
    return this.box;
  }

  // -------------------------------------------------------------------------
  // The shop's account
  // -------------------------------------------------------------------------

  async account(organizationId: string): Promise<WaveAccountDto> {
    const row = await this.database.db
      .selectFrom('app.organization_wave_accounts')
      .selectAll()
      .where('organization_id', '=', organizationId)
      .where('disconnected_at', 'is', null)
      .executeTakeFirst();
    return {
      connected: Boolean(row),
      keyHint: row?.key_hint ?? null,
      signing: Boolean(row?.signing_secret_sealed),
      webhook: Boolean(row?.webhook_secret_sealed),
      connectedAt: row?.connected_at.toISOString() ?? null,
      webhookPath: `/api/v1/public/wave/webhooks/${organizationId}`,
      available: this.box !== null,
    };
  }

  async connect(
    organizationId: string,
    user: AuthContext,
    input: ConnectWaveInput,
    requestId: string | null,
  ): Promise<WaveAccountDto> {
    const box = this.requireBox();
    // Wave tells whether the key opens the account before it is kept.
    await this.wave.probe({
      apiKey: input.apiKey,
      signingSecret: input.signingSecret,
    });
    const values = {
      api_key_sealed: box.seal(input.apiKey, organizationId),
      signing_secret_sealed: input.signingSecret
        ? box.seal(input.signingSecret, organizationId)
        : null,
      webhook_secret_sealed: input.webhookSecret
        ? box.seal(input.webhookSecret, organizationId)
        : null,
      key_hint: input.apiKey.slice(-4).replace(/[^A-Za-z0-9_-]/g, '_'),
      connected_by: user.userId,
      connected_at: new Date(),
      disconnected_at: null,
    };
    await this.database.db.transaction().execute(async (trx) => {
      await trx
        .insertInto('app.organization_wave_accounts')
        .values({ organization_id: organizationId, ...values })
        .onConflict((oc) => oc.column('organization_id').doUpdateSet(values))
        .execute();
      await this.audit.record(trx, {
        organizationId,
        actorType: 'user',
        actorId: user.userId,
        action: 'wave.connected',
        targetType: 'organization',
        targetId: organizationId,
        // Never the key: its last characters only.
        metadata: {
          keyHint: values.key_hint,
          signing: Boolean(input.signingSecret),
          webhook: Boolean(input.webhookSecret),
        },
        requestId,
      });
    });
    return this.account(organizationId);
  }

  /** The secrets are overwritten; the row stays (no delete in `app`). */
  async disconnect(
    organizationId: string,
    user: AuthContext,
    requestId: string | null,
  ): Promise<WaveAccountDto> {
    const box = this.requireBox();
    await this.database.db.transaction().execute(async (trx) => {
      const updated = await trx
        .updateTable('app.organization_wave_accounts')
        .set({
          api_key_sealed: box.seal('', organizationId),
          signing_secret_sealed: null,
          webhook_secret_sealed: null,
          key_hint: '----',
          disconnected_at: new Date(),
        })
        .where('organization_id', '=', organizationId)
        .where('disconnected_at', 'is', null)
        .returning('organization_id')
        .executeTakeFirst();
      if (updated)
        await this.audit.record(trx, {
          organizationId,
          actorType: 'user',
          actorId: user.userId,
          action: 'wave.disconnected',
          targetType: 'organization',
          targetId: organizationId,
          metadata: {},
          requestId,
        });
    });
    return this.account(organizationId);
  }

  private async credentials(
    organizationId: string,
  ): Promise<(WaveCredentials & { webhookSecret: string | null }) | null> {
    if (!this.box) return null;
    const row = await this.database.db
      .selectFrom('app.organization_wave_accounts')
      .selectAll()
      .where('organization_id', '=', organizationId)
      .where('disconnected_at', 'is', null)
      .executeTakeFirst();
    if (!row) return null;
    const box = this.box;
    return {
      apiKey: box.open(row.api_key_sealed, organizationId),
      signingSecret: row.signing_secret_sealed
        ? box.open(row.signing_secret_sealed, organizationId)
        : null,
      webhookSecret: row.webhook_secret_sealed
        ? box.open(row.webhook_secret_sealed, organizationId)
        : null,
    };
  }

  /** Whether the public receipt offers « Payer avec Wave ». */
  async takesWave(organizationId: string): Promise<boolean> {
    if (!this.box || !this.env.WEB_URL) return false;
    const row = await this.database.db
      .selectFrom('app.organization_wave_accounts')
      .select('organization_id')
      .where('organization_id', '=', organizationId)
      .where('disconnected_at', 'is', null)
      .executeTakeFirst();
    return Boolean(row);
  }

  // -------------------------------------------------------------------------
  // Paying an order
  // -------------------------------------------------------------------------

  /** A shop by its address, published or not: a payment may come later. */
  private async shopBySlug(slug: string) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 80)
      throw orderNotFound();
    const shop = await this.database.db
      .selectFrom('app.organizations')
      .select(['id', 'name', 'slug'])
      .where('slug', '=', slug)
      .where('status', '=', 'active')
      .executeTakeFirst();
    if (!shop) throw orderNotFound();
    return shop;
  }

  /**
   * The Wave page of an order: an open session is reused, so that a second
   * tap does not open a second payment.
   */
  async launch(slug: string, orderId: string): Promise<WaveLaunchDto> {
    if (!UUID_RE.test(orderId)) throw orderNotFound();
    const shop = await this.shopBySlug(slug);
    // An order of another shop is unknown here, before anything else.
    const known = await this.database.db
      .selectFrom('app.orders')
      .select('id')
      .where('organization_id', '=', shop.id)
      .where('id', '=', orderId)
      .executeTakeFirst();
    if (!known) throw orderNotFound();
    const credentials = await this.credentials(shop.id);
    const web = this.env.WEB_URL;
    if (!credentials || !web) throw notConnected();
    return this.database.db.transaction().execute(async (trx) => {
      const order = await locked(trx, shop.id, orderId);
      if (order.paid_at)
        throw new ApiException(
          HttpStatus.CONFLICT,
          'ORDER_ALREADY_PAID',
          'Cette commande est déjà payée.',
        );
      if (order.status === 'cancelled' || order.status === 'delivered')
        throw new ApiException(
          HttpStatus.CONFLICT,
          'ORDER_CLOSED',
          'Cette commande ne se paie plus en ligne.',
        );
      if (
        order.wave_session_id &&
        order.wave_launch_url &&
        order.wave_session_expires_at &&
        order.wave_session_expires_at.getTime() - Date.now() > SESSION_MARGIN_MS
      )
        return { launchUrl: order.wave_launch_url };

      const back = new URL(`/b/${shop.slug}/paiement/${order.id}`, web);
      const failed = new URL(back);
      failed.searchParams.set('echec', '1');
      const session = await this.wave.createSession(credentials, {
        amount: waveAmount(toNumber(order.total)),
        currency: order.currency,
        successUrl: back.toString(),
        errorUrl: failed.toString(),
        clientReference: order.id,
      });
      await trx
        .updateTable('app.orders')
        .set({
          wave_session_id: session.id,
          wave_launch_url: session.launchUrl,
          wave_session_expires_at: new Date(session.expiresAt),
        })
        .where('organization_id', '=', shop.id)
        .where('id', '=', order.id)
        .execute();
      return { launchUrl: session.launchUrl };
    });
  }

  /** What the customer sees on coming back from Wave. */
  async publicStatus(
    slug: string,
    orderId: string,
  ): Promise<PublicOrderStatusDto> {
    if (!UUID_RE.test(orderId)) throw orderNotFound();
    const shop = await this.shopBySlug(slug);
    const { order, wave } = await this.check(shop.id, orderId, null, null);
    return {
      reference: order.reference,
      total: toNumber(order.total),
      currency: order.currency,
      paid: order.paid_at !== null,
      wave,
      shopName: shop.name,
    };
  }

  /**
   * Asks Wave how the session of the order went, and marks the order paid
   * when it succeeded for its amount and currency. Safe to repeat.
   */
  async check(
    organizationId: string,
    orderId: string,
    user: AuthContext | null,
    requestId: string | null,
  ): Promise<{ order: Selectable<OrdersTable>; wave: WaveState }> {
    if (!UUID_RE.test(orderId)) throw orderNotFound();
    const current = await this.database.db
      .selectFrom('app.orders')
      .selectAll()
      .where('organization_id', '=', organizationId)
      .where('id', '=', orderId)
      .executeTakeFirst();
    if (!current) throw orderNotFound();
    if (!current.wave_session_id)
      return { order: current, wave: current.paid_at ? 'succeeded' : 'none' };
    if (current.paid_at) return { order: current, wave: 'succeeded' };
    const credentials = await this.credentials(organizationId);
    if (!credentials) return { order: current, wave: 'open' };

    const session = await this.wave.getSession(
      credentials,
      current.wave_session_id,
    );
    const state = stateOf(session);
    if (state !== 'succeeded') return { order: current, wave: state };
    if (
      session.amount !== waveAmount(toNumber(current.total)) ||
      session.currency !== current.currency ||
      session.id !== current.wave_session_id
    ) {
      // Paid, but not what the order says: told to the seller, not applied.
      this.logger.warn(
        `Paiement Wave différent de la commande ${current.reference} : ${session.amount} ${session.currency}`,
      );
      return { order: current, wave: 'failed' };
    }

    const order = await this.database.db.transaction().execute(async (trx) => {
      const order = await locked(trx, organizationId, orderId);
      if (order.paid_at) return order;
      const updated = await trx
        .updateTable('app.orders')
        .set({
          paid_at: new Date(),
          payment_method: 'mobile_money',
          payment_provider: 'wave',
          payment_reference: session.transactionId ?? session.id,
          wave_transaction_id: session.transactionId,
          ...(user ? { updated_by: user.userId } : {}),
        })
        .where('organization_id', '=', organizationId)
        .where('id', '=', orderId)
        .returningAll()
        .executeTakeFirstOrThrow();
      await this.audit.record(trx, {
        organizationId,
        // Wave said it: the platform records it, whoever asked.
        actorType: user ? 'user' : 'system',
        actorId: user?.userId ?? null,
        action: 'order.paid',
        targetType: 'order',
        targetId: orderId,
        metadata: {
          reference: updated.reference,
          method: 'mobile_money',
          provider: 'wave',
          via: 'wave_checkout',
          transactionId: session.transactionId,
        },
        requestId,
      });
      return updated;
    });
    return { order, wave: 'succeeded' };
  }

  // -------------------------------------------------------------------------
  // Optional webhook
  // -------------------------------------------------------------------------

  /**
   * A webhook only says « look again »: the session is fetched from Wave
   * with the shop's key before anything changes.
   */
  async webhook(
    organizationId: string,
    headers: { signature?: string; authorization?: string },
    rawBody: string,
  ): Promise<void> {
    if (!UUID_RE.test(organizationId)) throw unauthorized();
    const credentials = await this.credentials(organizationId);
    const secret = credentials?.webhookSecret;
    if (!secret) throw unauthorized();
    const signed = verifyWaveSignature(
      secret,
      headers.signature,
      rawBody,
      Math.floor(Date.now() / 1000),
    );
    // The « Shared Secret » strategy of the portal sends it as a bearer.
    const shared = headers.authorization === `Bearer ${secret}`;
    if (!signed && !shared) throw unauthorized();

    let event: { type?: unknown; data?: { id?: unknown } };
    try {
      event = JSON.parse(rawBody) as typeof event;
    } catch (error) {
      this.logger.warn(`Webhook Wave illisible : ${String(error)}`);
      return;
    }
    if (
      event.type !== 'checkout.session.completed' ||
      typeof event.data?.id !== 'string'
    )
      return;
    const order = await this.database.db
      .selectFrom('app.orders')
      .select('id')
      .where('organization_id', '=', organizationId)
      .where('wave_session_id', '=', event.data.id)
      .executeTakeFirst();
    if (!order) return;
    await this.check(organizationId, order.id, null, null);
  }
}

function stateOf(session: WaveSession): WaveState {
  if (session.paymentStatus === 'succeeded') return 'succeeded';
  if (session.checkoutStatus === 'expired') return 'expired';
  if (session.paymentStatus === 'cancelled') return 'failed';
  return 'open';
}

function unauthorized(): ApiException {
  return new ApiException(
    HttpStatus.UNAUTHORIZED,
    'WAVE_SIGNATURE_INVALID',
    'Signature Wave invalide.',
  );
}

async function locked(
  trx: Transaction<Database>,
  organizationId: string,
  id: string,
): Promise<Selectable<OrdersTable>> {
  const order = await trx
    .selectFrom('app.orders')
    .selectAll()
    .where('organization_id', '=', organizationId)
    .where('id', '=', id)
    .forUpdate()
    .executeTakeFirst();
  if (!order) throw orderNotFound();
  return order;
}
