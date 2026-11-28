import { createHash } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  availabilityOf,
  firstNameOf,
  internationalPhone,
  isArticleHandle,
  isStorefrontSlug,
  orderLineTotal,
  quantityFitsUnit,
  slugify,
  storefrontDueOnAllowed,
  STOREFRONT_HONEYPOT,
  type PublicArticleDto,
  type PublicOrderInput,
  type PublicOrderResultDto,
  type PublicStorefrontDto,
  type PublicTrackingDto,
  type StorefrontArticleSettingDto,
  type StorefrontArticlesInput,
  type StorefrontSettingsDto,
  type UpdateStorefrontInput,
} from '@nagaw/shared';
import { sql } from 'kysely';
import { AuditService } from '../audit/audit.service.js';
import {
  conflict,
  invalid,
  notFound,
  toNullableNumber,
  toNumber,
  type Executor,
} from '../catalog/catalog.errors.js';
import { ApiException } from '../common/api-exception.js';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { today } from '../common/today.js';
import { DatabaseService } from '../database/database.service.js';
import type { StoredOrderLine } from '../database/schema.js';
import { takeSequenceNumber } from '../database/sequences.js';
import { AlertsService } from '../notifications/alerts.service.js';

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

/** The same answer whether the storefront is off, unknown or suspended. */
const unavailable = () =>
  notFound('STOREFRONT_NOT_FOUND', 'Cette vitrine n’est pas disponible.');

const tooMany = () =>
  new ApiException(
    HttpStatus.TOO_MANY_REQUESTS,
    'TOO_MANY_ORDERS',
    'Trop de commandes envoyées. Réessayez plus tard, ou écrivez à la boutique sur WhatsApp.',
  );

/**
 * The tracking token: derived from the operation id the visitor's page
 * generated (122 random bits) and the order's own id, so that an order
 * sent twice answers with the same link. Only its sha256 is kept.
 */
const trackingToken = (clientOperationId: string, orderId: string) =>
  sha256(`storefront-tracking:${clientOperationId}:${orderId}`).slice(0, 40);

interface Shop {
  id: string;
  name: string;
  timezone: string;
  default_currency: string;
  phone: string;
  phone_country_code: string;
  logo_sha256: string | null;
  storefront_enabled: boolean;
  storefront_tagline: string;
  storefront_landmark: string;
  storefront_hours: string;
  storefront_whatsapp: string;
  storefront_indexable: boolean;
}

/**
 * Ma vitrine (ADR-075). The public part never trusts anything but the
 * address: the shop is found by the server from it, and what leaves is
 * built from a closed list of fields — no purchase price, no stock
 * figure, no internal identifier.
 */
@Injectable()
export class StorefrontService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
    private readonly alerts: AlertsService,
  ) {}

  // -------------------------------------------------------------------------
  // Public
  // -------------------------------------------------------------------------

  /** The shop behind an address, and its current address. */
  private async resolve(
    executor: Executor,
    slug: string,
  ): Promise<{ shop: Shop; current: string }> {
    const address = slug.toLowerCase();
    if (!isStorefrontSlug(address)) throw unavailable();
    const row = await executor
      .selectFrom('app.storefront_slugs as s')
      .innerJoin('app.organizations as o', 'o.id', 's.organization_id')
      .select([
        'o.id',
        'o.name',
        'o.timezone',
        'o.default_currency',
        'o.phone',
        'o.phone_country_code',
        'o.logo_sha256',
        'o.storefront_enabled',
        'o.storefront_tagline',
        'o.storefront_landmark',
        'o.storefront_hours',
        'o.storefront_whatsapp',
        'o.storefront_indexable',
        'o.status',
      ])
      .where('s.slug', '=', address)
      .executeTakeFirst();
    if (!row || row.status !== 'active' || !row.storefront_enabled)
      throw unavailable();
    const current = await executor
      .selectFrom('app.storefront_slugs')
      .select('slug')
      .where('organization_id', '=', row.id)
      .where('is_current', '=', true)
      .executeTakeFirstOrThrow();
    return { shop: row, current: current.slug };
  }

  private whatsappOf(shop: Shop): string | null {
    return internationalPhone(
      shop.storefront_whatsapp || shop.phone,
      shop.phone_country_code,
    );
  }

  private articlesQuery(executor: Executor, organizationId: string) {
    return executor
      .selectFrom('app.products as p')
      .leftJoin('app.product_categories as c', (join) =>
        join
          .onRef('c.organization_id', '=', 'p.organization_id')
          .onRef('c.id', '=', 'p.category_id'),
      )
      .leftJoin(
        (eb) =>
          eb
            .selectFrom('app.stock_movements')
            .select(['product_id'])
            .select((s) => s.fn.sum<string>('quantity').as('quantity'))
            .where('organization_id', '=', organizationId)
            .groupBy('product_id')
            .as('s'),
        (join) => join.onRef('s.product_id', '=', 'p.id'),
      )
      .select([
        'p.id',
        'p.name',
        'p.kind',
        'p.unit',
        'p.sale_price',
        'p.open_price',
        'p.track_stock',
        'p.low_stock_threshold',
        'p.photo_sha256',
        'p.storefront_visible',
        'p.storefront_handle',
        'p.storefront_description',
        'p.storefront_price_mode',
        'c.name as category_name',
      ])
      .select(sql<string>`coalesce(s.quantity, 0)`.as('stock_quantity'))
      .where('p.organization_id', '=', organizationId)
      .where('p.status', '=', 'active')
      .where('p.system_role', 'is', null);
  }

  private availability(row: {
    kind: 'product' | 'service';
    track_stock: boolean;
    stock_quantity: string;
    low_stock_threshold: string | null;
  }) {
    return availabilityOf({
      kind: row.kind,
      trackStock: row.track_stock,
      stockQuantity: toNumber(row.stock_quantity),
      lowStockThreshold: toNullableNumber(row.low_stock_threshold),
    });
  }

  private priceOnRequest(row: {
    open_price: boolean;
    storefront_price_mode: 'shown' | 'on_request';
  }) {
    return row.open_price || row.storefront_price_mode === 'on_request';
  }

  async storefront(slug: string): Promise<PublicStorefrontDto> {
    const db = this.database.db;
    const { shop, current } = await this.resolve(db, slug);
    const rows = await this.articlesQuery(db, shop.id)
      .where('p.storefront_visible', '=', true)
      .where('p.storefront_handle', 'is not', null)
      .orderBy(sql`c.name nulls last`)
      .orderBy(sql`lower(p.name)`)
      .execute();
    const articles: PublicArticleDto[] = rows.map((row) => ({
      handle: row.storefront_handle!,
      name: row.name,
      kind: row.kind,
      category: row.category_name,
      unit: row.unit,
      price: this.priceOnRequest(row) ? null : toNumber(row.sale_price),
      description: row.storefront_description,
      availability: this.availability(row),
      photoVersion: row.photo_sha256?.slice(0, 16) ?? null,
    }));
    return {
      slug: current,
      movedTo: current === slug.toLowerCase() ? null : current,
      name: shop.name,
      tagline: shop.storefront_tagline,
      landmark: shop.storefront_landmark,
      hours: shop.storefront_hours,
      whatsapp: this.whatsappOf(shop),
      indexable: shop.storefront_indexable,
      currency: shop.default_currency,
      timezone: shop.timezone,
      today: today(shop.timezone),
      logoVersion: shop.logo_sha256?.slice(0, 16) ?? null,
      articles,
    };
  }

  /** The photo of a visible article; nothing for a hidden one. */
  async photo(slug: string, handle: string) {
    const db = this.database.db;
    const { shop } = await this.resolve(db, slug);
    if (!isArticleHandle(handle))
      throw notFound('PHOTO_NOT_FOUND', 'Pas de photo.');
    const row = await db
      .selectFrom('app.products as p')
      .innerJoin('app.product_photos as f', (join) =>
        join
          .onRef('f.organization_id', '=', 'p.organization_id')
          .onRef('f.product_id', '=', 'p.id')
          .onRef('f.sha256', '=', 'p.photo_sha256'),
      )
      .select(['f.content_type', 'f.data', 'f.sha256'])
      .where('p.organization_id', '=', shop.id)
      .where('p.storefront_handle', '=', handle)
      .where('p.storefront_visible', '=', true)
      .where('p.status', '=', 'active')
      .executeTakeFirst();
    if (!row) throw notFound('PHOTO_NOT_FOUND', 'Pas de photo.');
    return {
      contentType: row.content_type,
      data: row.data,
      sha256: row.sha256,
    };
  }

  async logo(slug: string) {
    const db = this.database.db;
    const { shop } = await this.resolve(db, slug);
    const row = await db
      .selectFrom('app.organization_logos')
      .select(['content_type', 'data', 'sha256'])
      .where('organization_id', '=', shop.id)
      .where('sha256', '=', shop.logo_sha256 ?? '')
      .executeTakeFirst();
    if (!row) throw notFound('LOGO_NOT_FOUND', 'Pas de logo.');
    return {
      contentType: row.content_type,
      data: row.data,
      sha256: row.sha256,
    };
  }

  /** A visit: counted by day, without cookie or address. */
  async visit(slug: string): Promise<void> {
    const db = this.database.db;
    const { shop } = await this.resolve(db, slug);
    await sql`
      insert into app.storefront_daily_stats (organization_id, day, visits)
      values (${shop.id}, ${today(shop.timezone)}::date, 1)
      on conflict (organization_id, day)
      do update set visits = app.storefront_daily_stats.visits + 1`.execute(db);
  }

  /**
   * Counts one more order for the key, in one statement (parallel sends
   * each take their place); false past the limit. A window that is over
   * starts again.
   */
  private async withinLimit(
    executor: Executor,
    key: string,
    limit: number,
    windowMinutes: number,
  ): Promise<boolean> {
    const { rows } = await sql<{ count: number }>`
      insert into app.storefront_order_limits as l (key, count, window_started_at)
      values (${key}, 1, now())
      on conflict (key) do update set
        count = case
          when l.window_started_at < now() - make_interval(mins => ${windowMinutes}) then 1
          else l.count + 1 end,
        window_started_at = case
          when l.window_started_at < now() - make_interval(mins => ${windowMinutes}) then now()
          else l.window_started_at end
      returning count`.execute(executor);
    return rows[0]!.count <= limit;
  }

  async placeOrder(
    slug: string,
    input: PublicOrderInput,
    visitorAddress: string,
  ): Promise<{ result: PublicOrderResultDto; replayed: boolean }> {
    const db = this.database.db;
    const { shop } = await this.resolve(db, slug);

    // A robot filled the field people never see: the same answer, nothing
    // kept.
    if (input[STOREFRONT_HONEYPOT] !== '')
      return {
        result: {
          number: `C-${today(shop.timezone).slice(0, 4)}-0000`,
          status: 'to_confirm',
          trackingToken: sha256(input.clientOperationId).slice(0, 40),
        },
        replayed: false,
      };

    const previous = await db
      .selectFrom('app.orders')
      .select(['id', 'number', 'status'])
      .where('organization_id', '=', shop.id)
      .where('client_operation_id', '=', input.clientOperationId)
      .where('source', '=', 'storefront')
      .executeTakeFirst();
    if (previous)
      return {
        result: {
          number: previous.number,
          status: previous.status,
          trackingToken: trackingToken(input.clientOperationId, previous.id),
        },
        replayed: true,
      };

    const day = today(shop.timezone);
    if (!storefrontDueOnAllowed(input.dueOn, day))
      throw invalid(
        'dueOn',
        'Choisissez un jour entre aujourd’hui et dans 30 jours.',
      );
    const phone =
      internationalPhone(input.phone, shop.phone_country_code) ??
      input.phone.replace(/\D/g, '');

    const settings = await db
      .selectFrom('app.platform_settings')
      .select([
        'storefront_max_orders_per_ip_hour',
        'storefront_max_orders_per_phone_day',
        'storefront_max_pending_per_phone',
      ])
      .executeTakeFirstOrThrow();
    // Counted before anything is written, outside the order's
    // transaction: a refused order still counts.
    const ipOk = await this.withinLimit(
      db,
      `ip:${sha256(visitorAddress)}`,
      settings.storefront_max_orders_per_ip_hour,
      60,
    );
    const phoneOk = await this.withinLimit(
      db,
      `phone:${shop.id}:${phone}`,
      settings.storefront_max_orders_per_phone_day,
      24 * 60,
    );
    if (!ipOk || !phoneOk) throw tooMany();

    const handles = [...new Set(input.lines.map((l) => l.article))];
    const products = new Map(
      (
        await this.articlesQuery(db, shop.id)
          .where('p.storefront_visible', '=', true)
          .where('p.storefront_handle', 'in', handles)
          .execute()
      ).map((p) => [p.storefront_handle!, p]),
    );
    const lines: StoredOrderLine[] = input.lines.map((line, index) => {
      const product = products.get(line.article);
      if (!product)
        throw invalid(
          `lines.${index}.article`,
          'Cet article n’est plus sur la vitrine.',
        );
      if (this.availability(product) === 'sold_out')
        throw invalid(
          `lines.${index}.article`,
          `« ${product.name} » est épuisé.`,
        );
      if (!quantityFitsUnit(line.quantity, product.unit))
        throw invalid(
          `lines.${index}.quantity`,
          `Quantité invalide pour « ${product.name} ».`,
        );
      if (this.priceOnRequest(product))
        return {
          productId: product.id,
          label: product.name,
          unit: product.unit,
          quantity: line.quantity,
          unitPrice: 0,
          lineTotal: 0,
          note: line.note,
          priceToSet: true,
        };
      const unitPrice = toNumber(product.sale_price);
      return {
        productId: product.id,
        label: product.name,
        unit: product.unit,
        quantity: line.quantity,
        unitPrice,
        lineTotal: orderLineTotal(unitPrice, line.quantity, null),
        note: line.note,
      };
    });
    const itemsTotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);

    const created = await db.transaction().execute(async (trx) => {
      // Locked with the shop: two sends of one person cannot both pass
      // the pending limit.
      await trx
        .selectFrom('app.organizations')
        .select('id')
        .where('id', '=', shop.id)
        .forUpdate()
        .executeTakeFirstOrThrow();
      const again = await trx
        .selectFrom('app.orders')
        .select(['id', 'number'])
        .where('organization_id', '=', shop.id)
        .where('client_operation_id', '=', input.clientOperationId)
        .executeTakeFirst();
      if (again) return { ...again, replayed: true };
      const { count } = await trx
        .selectFrom('app.orders')
        .select((eb) => eb.fn.countAll<string>().as('count'))
        .where('organization_id', '=', shop.id)
        .where('status', '=', 'to_confirm')
        .where('requester_phone', '=', phone)
        .executeTakeFirstOrThrow();
      if (Number(count) >= settings.storefront_max_pending_per_phone)
        throw new ApiException(
          HttpStatus.TOO_MANY_REQUESTS,
          'TOO_MANY_PENDING_ORDERS',
          'Vous avez déjà des commandes qui attendent la boutique. Attendez sa réponse, ou écrivez-lui sur WhatsApp.',
        );

      const next = await takeSequenceNumber(
        trx,
        shop.id,
        'order',
        Number(day.slice(0, 4)),
      );
      const number = `C-${day.slice(0, 4)}-${String(next).padStart(4, '0')}`;
      // The id first: the tracking token is derived from it.
      const { id } = await sql<{ id: string }>`
        select gen_random_uuid() as id`
        .execute(trx)
        .then((r) => r.rows[0]!);
      await trx
        .insertInto('app.orders')
        .values({
          id,
          organization_id: shop.id,
          number,
          customer_id: null,
          status: 'to_confirm',
          source: 'storefront',
          requester_name: input.name,
          requester_phone: phone,
          tracking_token_hash: sha256(
            trackingToken(input.clientOperationId, id),
          ),
          lines: JSON.stringify(lines),
          items_total: itemsTotal,
          due_on: input.dueOn,
          due_time: input.dueTime,
          fulfilment: 'pickup',
          note: input.note,
          client_operation_id: input.clientOperationId,
          created_by: null,
        })
        .execute();
      await sql`
        insert into app.storefront_daily_stats (organization_id, day, orders_sent)
        values (${shop.id}, ${day}::date, 1)
        on conflict (organization_id, day)
        do update set orders_sent = app.storefront_daily_stats.orders_sent + 1`.execute(
        trx,
      );
      await this.audit.record(trx, {
        organizationId: shop.id,
        actorType: 'system',
        actorId: null,
        action: 'order.storefront_received',
        targetType: 'order',
        targetId: id,
        metadata: { number, total: itemsTotal, articles: lines.length },
        requestId: null,
      });
      await this.alerts.storefrontOrder(trx, {
        organizationId: shop.id,
        orderId: id,
        number,
        firstName: firstNameOf(input.name),
        articles: lines.length,
      });
      return { id, number, replayed: false };
    });
    await this.alerts.flush(shop.id);
    return {
      result: {
        number: created.number,
        status: 'to_confirm',
        trackingToken: trackingToken(input.clientOperationId, created.id),
      },
      replayed: created.replayed,
    };
  }

  async tracking(slug: string, token: string): Promise<PublicTrackingDto> {
    const lost = () =>
      notFound('ORDER_NOT_FOUND', 'Commande introuvable. Vérifiez le lien.');
    if (!/^[0-9a-f]{40}$/.test(token)) throw lost();
    const db = this.database.db;
    const row = await db
      .selectFrom('app.orders as o')
      .innerJoin('app.organizations as g', 'g.id', 'o.organization_id')
      .select([
        'o.organization_id',
        'o.number',
        'o.status',
        'o.lines',
        'o.items_total',
        'o.requester_name',
        'o.due_time',
        'o.cancellation_reason',
        'o.created_at',
        sql<string>`o.due_on::text`.as('due_day'),
        'g.name',
        'g.phone',
        'g.phone_country_code',
        'g.default_currency',
        'g.storefront_landmark',
        'g.storefront_whatsapp',
      ])
      .where('o.tracking_token_hash', '=', sha256(token))
      .where('o.source', '=', 'storefront')
      .executeTakeFirst();
    if (!row) throw lost();
    // The link names the shop: another shop's address never shows it.
    const address = await db
      .selectFrom('app.storefront_slugs')
      .select(['organization_id'])
      .where('slug', '=', slug.toLowerCase())
      .executeTakeFirst();
    if (!address || address.organization_id !== row.organization_id)
      throw lost();
    const current = await db
      .selectFrom('app.storefront_slugs')
      .select('slug')
      .where('organization_id', '=', row.organization_id)
      .where('is_current', '=', true)
      .executeTakeFirst();
    return {
      number: row.number,
      status: row.status,
      shopName: row.name,
      slug: current?.slug ?? null,
      landmark: row.storefront_landmark,
      whatsapp: internationalPhone(
        row.storefront_whatsapp || row.phone,
        row.phone_country_code,
      ),
      currency: row.default_currency,
      firstName: firstNameOf(row.requester_name),
      dueOn: row.due_day,
      dueTime: row.due_time?.slice(0, 5) ?? null,
      lines: row.lines.map((l) => ({
        label: l.label,
        quantity: l.quantity,
        lineTotal: l.priceToSet ? null : l.lineTotal,
      })),
      itemsTotal: toNumber(row.items_total),
      pricesToCome: row.lines.some((l) => l.priceToSet),
      declineReason:
        row.status === 'cancelled' ? row.cancellation_reason : null,
      createdAt: row.created_at.toISOString(),
    };
  }

  // -------------------------------------------------------------------------
  // The shop's settings
  // -------------------------------------------------------------------------

  private async currentSlug(executor: Executor, organizationId: string) {
    const row = await executor
      .selectFrom('app.storefront_slugs')
      .select('slug')
      .where('organization_id', '=', organizationId)
      .where('is_current', '=', true)
      .executeTakeFirst();
    return row?.slug ?? null;
  }

  /** A free address from the shop's name: `chez-awa`, `chez-awa-2`… */
  private async freeSlug(executor: Executor, name: string): Promise<string> {
    let base = slugify(name, 34);
    if (!isStorefrontSlug(base)) base = `boutique-${base}`.slice(0, 34);
    if (!isStorefrontSlug(base)) base = 'ma-boutique';
    for (let n = 1; n < 1000; n += 1) {
      const candidate = n === 1 ? base : `${base}-${n}`;
      const taken = await executor
        .selectFrom('app.storefront_slugs')
        .select('slug')
        .where('slug', '=', candidate)
        .executeTakeFirst();
      if (!taken) return candidate;
    }
    throw new Error(`No free storefront address for « ${name} »`);
  }

  async settings(organizationId: string): Promise<StorefrontSettingsDto> {
    const db = this.database.db;
    const org = await db
      .selectFrom('app.organizations')
      .select([
        'name',
        'timezone',
        'storefront_enabled',
        'storefront_tagline',
        'storefront_landmark',
        'storefront_hours',
        'storefront_whatsapp',
        'storefront_indexable',
      ])
      .where('id', '=', organizationId)
      .executeTakeFirstOrThrow();
    const day = today(org.timezone);
    const [slug, suggested, counts, week, pending] = await Promise.all([
      this.currentSlug(db, organizationId),
      this.freeSlug(db, org.name),
      db
        .selectFrom('app.products')
        .select((eb) => [
          eb.fn.countAll<string>().as('articles'),
          sql<string>`count(*) filter (where storefront_visible)`.as('visible'),
        ])
        .where('organization_id', '=', organizationId)
        .where('status', '=', 'active')
        .where('system_role', 'is', null)
        .executeTakeFirstOrThrow(),
      sql<{ visits: string; sent: string; accepted: string }>`
        select coalesce(sum(visits), 0) as visits,
               coalesce(sum(orders_sent), 0) as sent,
               coalesce(sum(orders_accepted), 0) as accepted
          from app.storefront_daily_stats
         where organization_id = ${organizationId}
           and day > ${day}::date - 7`.execute(db),
      db
        .selectFrom('app.orders')
        .select((eb) => eb.fn.countAll<string>().as('count'))
        .where('organization_id', '=', organizationId)
        .where('status', '=', 'to_confirm')
        .executeTakeFirstOrThrow(),
    ]);
    const w = week.rows[0]!;
    return {
      enabled: org.storefront_enabled,
      slug,
      suggestedSlug: slug ?? suggested,
      tagline: org.storefront_tagline,
      landmark: org.storefront_landmark,
      hours: org.storefront_hours,
      whatsapp: org.storefront_whatsapp,
      indexable: org.storefront_indexable,
      visibleArticles: Number(counts.visible),
      articles: Number(counts.articles),
      week: {
        visits: Number(w.visits),
        ordersSent: Number(w.sent),
        ordersAccepted: Number(w.accepted),
      },
      toConfirm: Number(pending.count),
    };
  }

  async update(
    tenant: TenantContext,
    user: AuthContext,
    input: UpdateStorefrontInput,
    requestId: string | null,
  ): Promise<StorefrontSettingsDto> {
    const organizationId = tenant.organizationId;
    await this.database.db.transaction().execute(async (trx) => {
      const org = await trx
        .selectFrom('app.organizations')
        .select(['name', 'storefront_enabled'])
        .where('id', '=', organizationId)
        .forUpdate()
        .executeTakeFirstOrThrow();
      let slug = await this.currentSlug(trx, organizationId);
      const wanted =
        input.slug ??
        (input.enabled && !slug
          ? await this.freeSlug(trx, org.name)
          : undefined);
      if (wanted && wanted !== slug) {
        const owner = await trx
          .selectFrom('app.storefront_slugs')
          .select('organization_id')
          .where('slug', '=', wanted)
          .executeTakeFirst();
        if (owner && owner.organization_id !== organizationId)
          throw conflict(
            'STOREFRONT_SLUG_TAKEN',
            'Cette adresse est déjà prise par une autre boutique. Essayez-en une autre.',
          );
        await trx
          .updateTable('app.storefront_slugs')
          .set({ is_current: false })
          .where('organization_id', '=', organizationId)
          .where('is_current', '=', true)
          .execute();
        if (owner)
          await trx
            .updateTable('app.storefront_slugs')
            .set({ is_current: true })
            .where('slug', '=', wanted)
            .execute();
        else
          await trx
            .insertInto('app.storefront_slugs')
            .values({ slug: wanted, organization_id: organizationId })
            .execute();
        await this.audit.record(trx, {
          organizationId,
          actorType: 'user',
          actorId: user.userId,
          action: 'storefront.address_changed',
          metadata: { from: slug, to: wanted },
          requestId,
        });
        slug = wanted;
      }
      const set = {
        ...(input.enabled !== undefined
          ? {
              storefront_enabled: input.enabled,
              // Orders come with the storefront (ADR-075).
              ...(input.enabled ? { orders_enabled: true } : {}),
            }
          : {}),
        ...(input.tagline !== undefined
          ? { storefront_tagline: input.tagline }
          : {}),
        ...(input.landmark !== undefined
          ? { storefront_landmark: input.landmark }
          : {}),
        ...(input.hours !== undefined ? { storefront_hours: input.hours } : {}),
        ...(input.whatsapp !== undefined
          ? { storefront_whatsapp: input.whatsapp }
          : {}),
        ...(input.indexable !== undefined
          ? { storefront_indexable: input.indexable }
          : {}),
      };
      if (Object.keys(set).length > 0)
        await trx
          .updateTable('app.organizations')
          .set(set)
          .where('id', '=', organizationId)
          .execute();
      if (
        input.enabled !== undefined &&
        input.enabled !== org.storefront_enabled
      )
        await this.audit.record(trx, {
          organizationId,
          actorType: 'user',
          actorId: user.userId,
          action: input.enabled ? 'storefront.enabled' : 'storefront.disabled',
          metadata: { slug },
          requestId,
        });
    });
    return this.settings(organizationId);
  }

  async articles(
    organizationId: string,
  ): Promise<StorefrontArticleSettingDto[]> {
    const rows = await this.articlesQuery(this.database.db, organizationId)
      .orderBy(sql`c.name nulls last`)
      .orderBy(sql`lower(p.name)`)
      .execute();
    return rows.map((row) => ({
      productId: row.id,
      name: row.name,
      kind: row.kind,
      categoryName: row.category_name,
      salePrice: toNumber(row.sale_price),
      openPrice: row.open_price,
      visible: row.storefront_visible,
      priceMode: row.open_price ? 'on_request' : row.storefront_price_mode,
      description: row.storefront_description,
      hasPhoto: row.photo_sha256 !== null,
      availability: this.availability(row),
    }));
  }

  /** A free handle in the shop from the article's name. */
  private async freeHandle(
    executor: Executor,
    organizationId: string,
    name: string,
  ): Promise<string> {
    let base = slugify(name, 54);
    if (!isArticleHandle(base)) base = `article-${base}`.slice(0, 54);
    if (!isArticleHandle(base)) base = 'article';
    for (let n = 1; n < 10000; n += 1) {
      const candidate = n === 1 ? base : `${base}-${n}`;
      const taken = await executor
        .selectFrom('app.products')
        .select('id')
        .where('organization_id', '=', organizationId)
        .where('storefront_handle', '=', candidate)
        .executeTakeFirst();
      if (!taken) return candidate;
    }
    throw new Error(`No free handle for « ${name} »`);
  }

  async setArticles(
    tenant: TenantContext,
    user: AuthContext,
    input: StorefrontArticlesInput,
    requestId: string | null,
  ): Promise<StorefrontArticleSettingDto[]> {
    const organizationId = tenant.organizationId;
    await this.database.db.transaction().execute(async (trx) => {
      const ids = [...new Set(input.articles.map((a) => a.productId))];
      const products = new Map(
        (
          await trx
            .selectFrom('app.products')
            .select(['id', 'name', 'storefront_handle', 'system_role'])
            .where('organization_id', '=', organizationId)
            .where('id', 'in', ids)
            .where('status', '=', 'active')
            .forUpdate()
            .execute()
        ).map((p) => [p.id, p]),
      );
      let shown = 0;
      for (const [index, article] of input.articles.entries()) {
        const product = products.get(article.productId);
        if (!product || product.system_role)
          throw invalid(
            `articles.${index}.productId`,
            'Produit inconnu ou archivé.',
          );
        const handle =
          article.visible && !product.storefront_handle
            ? await this.freeHandle(trx, organizationId, product.name)
            : product.storefront_handle;
        if (article.visible) shown += 1;
        await trx
          .updateTable('app.products')
          .set({
            storefront_visible: article.visible,
            storefront_handle: handle,
            ...(article.priceMode
              ? { storefront_price_mode: article.priceMode }
              : {}),
            ...(article.description !== undefined
              ? { storefront_description: article.description }
              : {}),
          })
          .where('organization_id', '=', organizationId)
          .where('id', '=', article.productId)
          .execute();
      }
      await this.audit.record(trx, {
        organizationId,
        actorType: 'user',
        actorId: user.userId,
        action: 'storefront.articles_updated',
        metadata: { changed: input.articles.length, shown },
        requestId,
      });
    });
    return this.articles(organizationId);
  }
}
