import { randomBytes } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  ACCOUNT_PHONE_RE,
  canMove,
  internationalPhone,
  orderReference,
  showsModule,
  type CancelOrderInput,
  type CatalogSettingsDto,
  type CatalogSettingsInput,
  type DeliverOrderInput,
  type OrderCountsDto,
  type OrderDto,
  type OrderListQuery,
  type OrderPaymentInput,
  type OrderStatus,
  type PublicCatalogDto,
  type PublicOrderInput,
  type PublicOrderReceiptDto,
  type PublicShopDto,
  type ShipOrderInput,
} from '@nagaw/shared';
import {
  sql,
  type Kysely,
  type Selectable,
  type Transaction,
  type Updateable,
} from 'kysely';
import { AuditService } from '../audit/audit.service.js';
import { invalid, toNumber } from '../catalog/catalog.errors.js';
import { ApiException } from '../common/api-exception.js';
import { pageOf } from '../common/page.js';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { DatabaseService } from '../database/database.service.js';
import { pgErrorCode, UNIQUE_VIOLATION } from '../database/pg-errors.js';
import type {
  Database,
  OrdersTable,
  OrganizationsTable,
} from '../database/schema.js';
import { SalesService } from '../sales/sales.service.js';

type Executor = Kysely<Database> | Transaction<Database>;

const MAX_REFERENCE_ATTEMPTS = 5;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The same answer for a shop that does not exist and one that is closed. */
const shopNotFound = () =>
  new ApiException(
    HttpStatus.NOT_FOUND,
    'SHOP_NOT_FOUND',
    'Cette boutique n’a pas de catalogue en ligne.',
  );

const orderNotFound = () =>
  new ApiException(
    HttpStatus.NOT_FOUND,
    'ORDER_NOT_FOUND',
    'Commande introuvable.',
  );

/**
 * Catalogue in a link and orders from a distance (ADR-063). The public side
 * reads only what a customer may see: name, logo, products sold online with
 * their sale price and whether they are available. Never a purchase price,
 * a stock quantity, a customer or a figure.
 */
@Injectable()
export class OrdersService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
    private readonly sales: SalesService,
  ) {}

  // -------------------------------------------------------------------------
  // Public side
  // -------------------------------------------------------------------------

  /** A shop whose catalogue is open: active, module shown, published. */
  private async openShop(
    executor: Executor,
    slug: string,
    lock = false,
  ): Promise<Selectable<OrganizationsTable>> {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 80)
      throw shopNotFound();
    let query = executor
      .selectFrom('app.organizations')
      .selectAll()
      .where('slug', '=', slug)
      .where('status', '=', 'active')
      .where('catalog_published', '=', true);
    if (lock) query = query.forUpdate();
    const shop = await query.executeTakeFirst();
    if (!shop || !showsModule(shop.hidden_modules, 'orders'))
      throw shopNotFound();
    return shop;
  }

  async catalog(slug: string): Promise<PublicCatalogDto> {
    const shop = await this.openShop(this.database.db, slug);
    const products = await this.onlineProducts(this.database.db, shop.id);
    return {
      shop: publicShop(shop),
      products: products.map((row) => ({
        id: row.id,
        name: row.name,
        price: toNumber(row.sale_price),
        unit: row.unit,
        available: row.available,
        photoVersion: row.photo_sha256?.slice(0, 16) ?? null,
        category: row.category_name,
      })),
    };
  }

  /** The id of an open shop, for its logo and its photos. */
  async openShopId(slug: string): Promise<string> {
    return (await this.openShop(this.database.db, slug)).id;
  }

  /** Whether this product is in the public catalogue of the shop. */
  async assertOnline(organizationId: string, productId: string) {
    if (!UUID_RE.test(productId)) throw shopNotFound();
    const found = await this.database.db
      .selectFrom('app.products')
      .select('id')
      .where('organization_id', '=', organizationId)
      .where('id', '=', productId)
      .where('status', '=', 'active')
      .where('sold_online', '=', true)
      .executeTakeFirst();
    if (!found) throw shopNotFound();
  }

  private onlineProducts(
    executor: Executor,
    organizationId: string,
    ids?: readonly string[],
  ) {
    let query = executor
      .selectFrom('app.products as p')
      .leftJoin('app.product_categories as c', (join) =>
        join
          .onRef('c.organization_id', '=', 'p.organization_id')
          .onRef('c.id', '=', 'p.category_id'),
      )
      .select([
        'p.id',
        'p.name',
        'p.unit',
        'p.sale_price',
        'p.photo_sha256',
        'c.name as category_name',
      ])
      // A service, or a product not counted, can always be ordered.
      .select(
        sql<boolean>`(p.kind = 'service' or not p.track_stock or coalesce((
          select sum(m.quantity) from app.stock_movements m
           where m.organization_id = p.organization_id and m.product_id = p.id
        ), 0) > 0)`.as('available'),
      )
      .where('p.organization_id', '=', organizationId)
      .where('p.status', '=', 'active')
      .where('p.sold_online', '=', true)
      .where('p.sale_price', '>', '0')
      .orderBy('c.name')
      .orderBy('p.name')
      .orderBy('p.id')
      .limit(500);
    if (ids) query = query.where('p.id', 'in', [...ids]);
    return query.execute();
  }

  /** An order from the public page: no account, so strict limits. */
  async place(
    slug: string,
    input: PublicOrderInput,
  ): Promise<PublicOrderReceiptDto> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.database.db
          .transaction()
          .execute((trx) => this.insertOrder(trx, slug, input));
      } catch (error) {
        // Two orders drew the same reference: draw again.
        if (
          pgErrorCode(error) === UNIQUE_VIOLATION &&
          attempt < MAX_REFERENCE_ATTEMPTS
        )
          continue;
        throw error;
      }
    }
  }

  private async insertOrder(
    trx: Transaction<Database>,
    slug: string,
    input: PublicOrderInput,
  ): Promise<PublicOrderReceiptDto> {
    // Serializes the orders of a shop: the limits below are counted exactly.
    const shop = await this.openShop(trx, slug, true);

    const phone = internationalPhone(input.phone, shop.phone_country_code);
    if (!phone || !ACCOUNT_PHONE_RE.test(phone))
      throw invalid('phone', 'Numéro de téléphone invalide');

    const settings = await trx
      .selectFrom('app.platform_settings')
      .select([
        'public_orders_per_phone_per_hour',
        'public_orders_per_shop_per_hour',
      ])
      .executeTakeFirstOrThrow();
    const recent = await trx
      .selectFrom('app.orders')
      .select([
        sql<string>`count(*) filter (where customer_phone = ${phone})`.as(
          'by_phone',
        ),
        sql<string>`count(*) filter (where organization_id = ${shop.id})`.as(
          'by_shop',
        ),
      ])
      .where('created_at', '>', sql<Date>`now() - interval '1 hour'`)
      .where((eb) =>
        eb.or([
          eb('customer_phone', '=', phone),
          eb('organization_id', '=', shop.id),
        ]),
      )
      .executeTakeFirstOrThrow();
    if (
      toNumber(recent.by_phone) >= settings.public_orders_per_phone_per_hour ||
      toNumber(recent.by_shop) >= settings.public_orders_per_shop_per_hour
    )
      throw new ApiException(
        HttpStatus.TOO_MANY_REQUESTS,
        'TOO_MANY_ORDERS',
        'Trop de commandes en peu de temps. Réessayez dans une heure, ou écrivez à la boutique sur WhatsApp.',
      );

    // The offer of the shop limits the orders of a month (ADR-063).
    const plan = await trx
      .selectFrom('app.subscriptions as s')
      .innerJoin('app.plans as p', 'p.key', 's.plan_key')
      .select('p.max_orders_per_month')
      .where('s.organization_id', '=', shop.id)
      .executeTakeFirst();
    const limit = plan?.max_orders_per_month ?? null;
    if (limit !== null) {
      const month = await this.ordersThisMonth(trx, shop.id, shop.timezone);
      if (month >= limit)
        throw new ApiException(
          HttpStatus.CONFLICT,
          'ORDER_LIMIT_REACHED',
          'La boutique ne prend plus de commande en ligne ce mois-ci. Écrivez-lui sur WhatsApp.',
        );
    }

    const ids = input.lines.map((line) => line.productId);
    const products = await this.onlineProducts(trx, shop.id, ids);
    const byId = new Map(products.map((p) => [p.id, p]));
    const lines = input.lines.map((line, index) => {
      const product = byId.get(line.productId);
      if (!product)
        throw invalid(
          `lines.${index}.productId`,
          'Cet article n’est plus en vente en ligne.',
        );
      if (!product.available)
        throw invalid(
          `lines.${index}.productId`,
          `« ${product.name} » est épuisé.`,
        );
      const unitPrice = toNumber(product.sale_price);
      return {
        productId: product.id,
        label: product.name,
        unitPrice,
        quantity: line.quantity,
        lineTotal: unitPrice * line.quantity,
      };
    });
    const total = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    if (total !== input.expectedTotal)
      throw new ApiException(
        HttpStatus.CONFLICT,
        'PRICE_CHANGED',
        'Les prix ont changé. Vérifiez votre panier.',
        [{ path: 'expectedTotal', message: String(total) }],
      );

    const order = await trx
      .insertInto('app.orders')
      .values({
        organization_id: shop.id,
        reference: orderReference(randomBytes(6)),
        customer_name: input.name,
        customer_phone: phone,
        customer_area: input.area,
        customer_note: input.note,
        total,
        currency: shop.default_currency,
      })
      .returning(['id', 'reference'])
      .executeTakeFirstOrThrow();
    await trx
      .insertInto('app.order_lines')
      .values(
        lines.map((line, position) => ({
          organization_id: shop.id,
          order_id: order.id,
          position,
          product_id: line.productId,
          label: line.label,
          unit_price: line.unitPrice,
          quantity: line.quantity,
          line_total: line.lineTotal,
        })),
      )
      .execute();
    // No person of the shop did it: the platform records it.
    await this.audit.record(trx, {
      organizationId: shop.id,
      actorType: 'system',
      actorId: null,
      action: 'order.received',
      targetType: 'order',
      targetId: order.id,
      metadata: { reference: order.reference, total },
      requestId: null,
    });

    const {
      name,
      phone: shopPhone,
      phoneCountryCode,
      payment,
      note,
    } = publicShop(shop);
    return {
      reference: order.reference,
      total,
      currency: shop.default_currency,
      lines: lines.map(({ label, quantity, lineTotal }) => ({
        label,
        quantity,
        lineTotal,
      })),
      shop: { name, phone: shopPhone, phoneCountryCode, payment, note },
    };
  }

  private async ordersThisMonth(
    executor: Executor,
    organizationId: string,
    timezone: string,
  ): Promise<number> {
    const row = await executor
      .selectFrom('app.orders')
      .select(sql<string>`count(*)`.as('n'))
      .where('organization_id', '=', organizationId)
      .where(
        sql<boolean>`date_trunc('month', created_at at time zone ${timezone}) = date_trunc('month', now() at time zone ${timezone})`,
      )
      .executeTakeFirstOrThrow();
    return toNumber(row.n);
  }

  // -------------------------------------------------------------------------
  // Shop side
  // -------------------------------------------------------------------------

  async list(
    organizationId: string,
    query: OrderListQuery,
  ): Promise<OrderDto[]> {
    let rows = this.database.db
      .selectFrom('app.orders')
      .selectAll()
      .where('organization_id', '=', organizationId)
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc');
    if (query.view === 'new') rows = rows.where('status', '=', 'new');
    if (query.view === 'open')
      rows = rows.where('status', 'in', ['new', 'confirmed', 'shipping']);
    if (query.view === 'remind')
      rows = rows
        .where('status', 'in', ['confirmed', 'shipping'])
        .where('paid_at', 'is', null);
    const orders = await pageOf(rows, query, 200).execute();
    return this.withLines(this.database.db, organizationId, orders);
  }

  async counts(organizationId: string): Promise<OrderCountsDto> {
    const row = await this.database.db
      .selectFrom('app.orders')
      .select([
        sql<string>`count(*) filter (where status = 'new')`.as('new'),
        sql<string>`count(*) filter (where status in ('new', 'confirmed', 'shipping'))`.as(
          'open',
        ),
        sql<string>`count(*) filter (where status in ('confirmed', 'shipping') and paid_at is null)`.as(
          'remind',
        ),
      ])
      .where('organization_id', '=', organizationId)
      .executeTakeFirstOrThrow();
    return {
      new: toNumber(row.new),
      open: toNumber(row.open),
      remind: toNumber(row.remind),
    };
  }

  async get(organizationId: string, id: string): Promise<OrderDto> {
    if (!UUID_RE.test(id)) throw orderNotFound();
    const row = await this.database.db
      .selectFrom('app.orders')
      .selectAll()
      .where('organization_id', '=', organizationId)
      .where('id', '=', id)
      .executeTakeFirst();
    if (!row) throw orderNotFound();
    const [order] = await this.withLines(this.database.db, organizationId, [
      row,
    ]);
    return order!;
  }

  async confirm(
    tenant: TenantContext,
    user: AuthContext,
    id: string,
    requestId: string | null,
  ): Promise<OrderDto> {
    return this.move(tenant, user, id, 'confirmed', requestId, () => ({
      confirmed_at: new Date(),
    }));
  }

  async pay(
    tenant: TenantContext,
    user: AuthContext,
    id: string,
    input: OrderPaymentInput,
    requestId: string | null,
  ): Promise<OrderDto> {
    return this.database.db.transaction().execute(async (trx) => {
      const order = await this.locked(trx, tenant.organizationId, id);
      if (order.status === 'cancelled' || order.status === 'delivered')
        throw closed(order.status);
      if (order.paid_at)
        throw new ApiException(
          HttpStatus.CONFLICT,
          'ORDER_ALREADY_PAID',
          'Cette commande est déjà marquée payée.',
        );
      const updated = await trx
        .updateTable('app.orders')
        .set({ ...paymentColumns(input), updated_by: user.userId })
        .where('organization_id', '=', tenant.organizationId)
        .where('id', '=', order.id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await this.record(trx, tenant, user, updated, 'order.paid', requestId, {
        method: input.method,
        provider: input.provider,
      });
      return (await this.withLines(trx, tenant.organizationId, [updated]))[0]!;
    });
  }

  async ship(
    tenant: TenantContext,
    user: AuthContext,
    id: string,
    input: ShipOrderInput,
    requestId: string | null,
  ): Promise<OrderDto> {
    return this.move(tenant, user, id, 'shipping', requestId, (shop) => {
      const courierPhone = input.courierPhone
        ? internationalPhone(input.courierPhone, shop.phone_country_code)
        : '';
      if (courierPhone === null || !/^([1-9][0-9]{7,14})?$/.test(courierPhone))
        throw invalid('courierPhone', 'Numéro de téléphone invalide');
      return {
        shipped_at: new Date(),
        courier_name: input.courierName,
        courier_phone: courierPhone,
        delivery_fee: input.deliveryFee,
      };
    });
  }

  /**
   * Delivered: the order becomes a sale, under the operation id drawn with
   * it, so that a second click finds the same sale (ADR-020). The order stays
   * locked while the sale is written: it cannot be cancelled meanwhile.
   */
  async deliver(
    tenant: TenantContext,
    user: AuthContext,
    id: string,
    input: DeliverOrderInput,
    requestId: string | null,
  ): Promise<OrderDto> {
    return this.database.db.transaction().execute(async (trx) => {
      const order = await this.locked(trx, tenant.organizationId, id);
      if (!canMove(order.status, 'delivered')) throw wrongStep(order.status);
      const payment: OrderPaymentInput | null = order.paid_at
        ? {
            method: order.payment_method!,
            provider: order.payment_provider,
            reference: order.payment_reference,
          }
        : input.payment;
      if (!payment)
        throw invalid('payment', 'Indiquez comment le client a payé.');

      const lines = await trx
        .selectFrom('app.order_lines')
        .select(['product_id', 'quantity', 'line_total'])
        .where('organization_id', '=', tenant.organizationId)
        .where('order_id', '=', order.id)
        .orderBy('position')
        .execute();
      const total = toNumber(order.total);
      const { sale } = await this.sales.create(
        tenant,
        user,
        {
          clientOperationId: order.sale_operation_id,
          customerId: null,
          // The price the customer agreed to when ordering.
          lines: lines.map((line) => ({
            productId: line.product_id,
            productUnitId: null,
            conversion: null,
            quantity: toNumber(line.quantity),
            agreedTotal: toNumber(line.line_total),
          })),
          discount: 0,
          payments: [
            {
              method: payment.method,
              amount: total,
              provider: payment.provider,
              reference: payment.reference || order.reference,
            },
          ],
          cashReceived: null,
          expectedTotal: total,
        },
        requestId,
      );

      const updated = await trx
        .updateTable('app.orders')
        .set({
          status: 'delivered',
          delivered_at: new Date(),
          sale_id: sale.id,
          ...(order.paid_at ? {} : paymentColumns(payment)),
          updated_by: user.userId,
        })
        .where('organization_id', '=', tenant.organizationId)
        .where('id', '=', order.id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await this.record(
        trx,
        tenant,
        user,
        updated,
        'order.delivered',
        requestId,
        { saleId: sale.id },
      );
      return (await this.withLines(trx, tenant.organizationId, [updated]))[0]!;
    });
  }

  async cancel(
    tenant: TenantContext,
    user: AuthContext,
    id: string,
    input: CancelOrderInput,
    requestId: string | null,
  ): Promise<OrderDto> {
    return this.move(tenant, user, id, 'cancelled', requestId, () => ({
      cancelled_at: new Date(),
      cancel_reason: input.reason,
    }));
  }

  private async move(
    tenant: TenantContext,
    user: AuthContext,
    id: string,
    to: OrderStatus,
    requestId: string | null,
    columns: (shop: Selectable<OrganizationsTable>) => Updateable<OrdersTable>,
  ): Promise<OrderDto> {
    return this.database.db.transaction().execute(async (trx) => {
      const order = await this.locked(trx, tenant.organizationId, id);
      if (!canMove(order.status, to)) throw wrongStep(order.status);
      const shop = await trx
        .selectFrom('app.organizations')
        .selectAll()
        .where('id', '=', tenant.organizationId)
        .executeTakeFirstOrThrow();
      const updated = await trx
        .updateTable('app.orders')
        .set({ ...columns(shop), status: to, updated_by: user.userId })
        .where('organization_id', '=', tenant.organizationId)
        .where('id', '=', order.id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await this.record(
        trx,
        tenant,
        user,
        updated,
        `order.${to}`,
        requestId,
        to === 'cancelled' ? { reason: updated.cancel_reason } : {},
      );
      return (await this.withLines(trx, tenant.organizationId, [updated]))[0]!;
    });
  }

  private async locked(
    trx: Transaction<Database>,
    organizationId: string,
    id: string,
  ): Promise<Selectable<OrdersTable>> {
    if (!UUID_RE.test(id)) throw orderNotFound();
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

  private record(
    trx: Transaction<Database>,
    tenant: TenantContext,
    user: AuthContext,
    order: Selectable<OrdersTable>,
    action: string,
    requestId: string | null,
    metadata: Record<string, unknown>,
  ) {
    return this.audit.record(trx, {
      organizationId: tenant.organizationId,
      actorType: 'user',
      actorId: user.userId,
      action,
      targetType: 'order',
      targetId: order.id,
      metadata: { reference: order.reference, ...metadata },
      requestId,
    });
  }

  private async withLines(
    executor: Executor,
    organizationId: string,
    orders: Selectable<OrdersTable>[],
  ): Promise<OrderDto[]> {
    if (orders.length === 0) return [];
    const lines = await executor
      .selectFrom('app.order_lines')
      .selectAll()
      .where('organization_id', '=', organizationId)
      .where(
        'order_id',
        'in',
        orders.map((order) => order.id),
      )
      .orderBy('position')
      .execute();
    return orders.map((order) => ({
      id: order.id,
      reference: order.reference,
      status: order.status,
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      customerArea: order.customer_area,
      customerNote: order.customer_note,
      total: toNumber(order.total),
      currency: order.currency,
      deliveryFee: toNumber(order.delivery_fee),
      courierName: order.courier_name,
      courierPhone: order.courier_phone,
      paidAt: order.paid_at?.toISOString() ?? null,
      payment: order.payment_method
        ? {
            method: order.payment_method,
            provider: order.payment_provider,
            reference: order.payment_reference,
          }
        : null,
      cancelReason: order.cancel_reason,
      saleId: order.sale_id,
      confirmedAt: order.confirmed_at?.toISOString() ?? null,
      shippedAt: order.shipped_at?.toISOString() ?? null,
      deliveredAt: order.delivered_at?.toISOString() ?? null,
      cancelledAt: order.cancelled_at?.toISOString() ?? null,
      createdAt: order.created_at.toISOString(),
      lines: lines
        .filter((line) => line.order_id === order.id)
        .map((line) => ({
          position: line.position,
          productId: line.product_id,
          label: line.label,
          unitPrice: toNumber(line.unit_price),
          quantity: toNumber(line.quantity),
          lineTotal: toNumber(line.line_total),
        })),
    }));
  }

  // -------------------------------------------------------------------------
  // Settings of the public page
  // -------------------------------------------------------------------------

  async settings(organizationId: string): Promise<CatalogSettingsDto> {
    const shop = await this.database.db
      .selectFrom('app.organizations as o')
      .leftJoin('app.subscriptions as s', 's.organization_id', 'o.id')
      .leftJoin('app.plans as p', 'p.key', 's.plan_key')
      .select([
        'o.slug',
        'o.timezone',
        'o.catalog_published',
        'o.order_wave_number',
        'o.order_orange_money_number',
        'o.order_note',
        'p.max_orders_per_month',
      ])
      .where('o.id', '=', organizationId)
      .executeTakeFirstOrThrow();
    return {
      slug: shop.slug,
      published: shop.catalog_published,
      waveNumber: shop.order_wave_number,
      orangeMoneyNumber: shop.order_orange_money_number,
      note: shop.order_note,
      ordersThisMonth: await this.ordersThisMonth(
        this.database.db,
        organizationId,
        shop.timezone,
      ),
      maxOrdersPerMonth: shop.max_orders_per_month ?? null,
    };
  }

  async updateSettings(
    organizationId: string,
    user: AuthContext,
    input: CatalogSettingsInput,
    requestId: string | null,
  ): Promise<CatalogSettingsDto> {
    await this.database.db.transaction().execute(async (trx) => {
      const before = await trx
        .selectFrom('app.organizations')
        .select(['catalog_published', 'hidden_modules'])
        .where('id', '=', organizationId)
        .forUpdate()
        .executeTakeFirstOrThrow();
      if (input.published && !showsModule(before.hidden_modules, 'orders'))
        throw invalid(
          'published',
          'Affichez d’abord « Commandes » dans le menu de la boutique.',
        );
      await trx
        .updateTable('app.organizations')
        .set({
          catalog_published: input.published,
          order_wave_number: input.waveNumber,
          order_orange_money_number: input.orangeMoneyNumber,
          order_note: input.note,
        })
        .where('id', '=', organizationId)
        .execute();
      await this.audit.record(trx, {
        organizationId,
        actorType: 'user',
        actorId: user.userId,
        action: 'catalog.updated',
        targetType: 'organization',
        targetId: organizationId,
        metadata: {
          published: { from: before.catalog_published, to: input.published },
        },
        requestId,
      });
    });
    return this.settings(organizationId);
  }
}

function publicShop(shop: Selectable<OrganizationsTable>): PublicShopDto {
  return {
    slug: shop.slug,
    name: shop.name,
    currency: shop.default_currency,
    phoneCountryCode: shop.phone_country_code,
    phone: shop.phone,
    logoVersion: shop.logo_sha256?.slice(0, 16) ?? null,
    note: shop.order_note,
    payment: {
      wave: shop.order_wave_number || null,
      orangeMoney: shop.order_orange_money_number || null,
    },
  };
}

function paymentColumns(payment: OrderPaymentInput) {
  return {
    paid_at: new Date(),
    payment_method: payment.method,
    payment_provider: payment.provider,
    payment_reference: payment.reference,
  };
}

function wrongStep(status: OrderStatus): ApiException {
  if (status === 'cancelled' || status === 'delivered') return closed(status);
  return new ApiException(
    HttpStatus.CONFLICT,
    'ORDER_WRONG_STEP',
    'Cette étape ne suit pas la précédente. Rechargez la commande.',
  );
}

function closed(status: 'cancelled' | 'delivered'): ApiException {
  return new ApiException(
    HttpStatus.CONFLICT,
    'ORDER_CLOSED',
    status === 'cancelled'
      ? 'Cette commande est annulée.'
      : 'Cette commande est déjà livrée.',
  );
}
