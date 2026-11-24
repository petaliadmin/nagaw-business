import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  formatAmount,
  isOpenOrder,
  orderLineTotal,
  orderTotals,
  roleHasPermission,
  type CancelOrderInput,
  type CreateOrderInput,
  type CreateSaleInput,
  type DeliverOrderInput,
  type OrderDepositInput,
  type OrderDto,
  type OrderListQuery,
  type OrdersSummaryDto,
  type OrderStatusInput,
  type PaymentInput,
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
import { ApiException } from '../common/api-exception.js';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { today } from '../common/today.js';
import { DatabaseService } from '../database/database.service.js';
import type {
  OrderPaymentsTable,
  OrdersTable,
  StoredOrderLine,
} from '../database/schema.js';
import { takeSequenceNumber } from '../database/sequences.js';
import { SalesService } from './sales.service.js';

const orderNotFound = () =>
  notFound('ORDER_NOT_FOUND', 'Commande introuvable.');
const closed = () =>
  conflict(
    'ORDER_CLOSED',
    'Cette commande est déjà remise ou annulée : elle ne change plus.',
  );

/** Orders shown at once in the list of those already closed. */
const CLOSED_SHOWN = 100;

type OrderRow = Selectable<OrdersTable> & {
  due_day: string;
  customer_name: string;
  customer_phone: string;
};

/**
 * Customer orders, phase 1 (ADR-072). Total, paid and what is left are
 * computed from the lines and the payments, never stored; the handover
 * records an ordinary sale, in the same transaction as the order closes.
 */
@Injectable()
export class OrdersService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
    private readonly sales: SalesService,
  ) {}

  private async shop(executor: Executor, organizationId: string) {
    return executor
      .selectFrom('app.organizations')
      .select([
        'timezone',
        'default_currency',
        'orders_enabled',
        'order_ready_reminder_days',
        'offer',
      ])
      .where('id', '=', organizationId)
      .executeTakeFirstOrThrow();
  }

  private baseQuery(executor: Executor, organizationId: string) {
    return executor
      .selectFrom('app.orders as o')
      .innerJoin('app.customers as c', (join) =>
        join
          .onRef('c.organization_id', '=', 'o.organization_id')
          .onRef('c.id', '=', 'o.customer_id'),
      )
      .selectAll('o')
      .select([
        sql<string>`o.due_on::text`.as('due_day'),
        'c.name as customer_name',
        'c.phone as customer_phone',
      ])
      .where('o.organization_id', '=', organizationId);
  }

  private async payments(
    executor: Executor,
    organizationId: string,
    orderIds: string[],
  ): Promise<Map<string, Selectable<OrderPaymentsTable>[]>> {
    const byOrder = new Map<string, Selectable<OrderPaymentsTable>[]>();
    if (orderIds.length === 0) return byOrder;
    const rows = await executor
      .selectFrom('app.order_payments')
      .selectAll()
      .where('organization_id', '=', organizationId)
      .where('order_id', 'in', orderIds)
      .orderBy('created_at')
      .orderBy('id')
      .execute();
    for (const row of rows)
      byOrder.set(row.order_id, [...(byOrder.get(row.order_id) ?? []), row]);
    return byOrder;
  }

  private toDto(
    row: OrderRow,
    payments: Selectable<OrderPaymentsTable>[],
    day: string,
  ): OrderDto {
    const paymentDtos = payments.map((p) => ({
      id: p.id,
      kind: p.kind,
      method: p.method,
      provider: p.provider,
      reference: p.reference,
      amount: toNumber(p.amount),
      createdAt: p.created_at.toISOString(),
    }));
    const itemsTotal = toNumber(row.items_total);
    const deliveryFee = toNumber(row.delivery_fee);
    const totals = orderTotals({
      itemsTotal,
      deliveryFee,
      payments: paymentDtos,
    });
    return {
      id: row.id,
      number: row.number,
      status: row.status,
      customer: {
        id: row.customer_id,
        name: row.customer_name,
        phone: row.customer_phone,
      },
      lines: row.lines,
      itemsTotal,
      deliveryFee,
      ...totals,
      dueOn: row.due_day,
      dueTime: row.due_time?.slice(0, 5) ?? null,
      late: isOpenOrder(row.status) && row.due_day < day,
      fulfilment: row.fulfilment,
      deliveryAddress: row.delivery_address,
      deliveryLandmark: row.delivery_landmark,
      deliveryPhone: row.delivery_phone,
      note: row.note,
      payments: paymentDtos,
      saleId: row.sale_id,
      deliveredAt: row.delivered_at?.toISOString() ?? null,
      cancellation:
        row.cancelled_at && row.cancellation_reason
          ? {
              at: row.cancelled_at.toISOString(),
              reason: row.cancellation_reason,
            }
          : null,
      createdAt: row.created_at.toISOString(),
    };
  }

  private async find(
    executor: Executor,
    organizationId: string,
    id: string,
  ): Promise<OrderDto> {
    if (!UUID_RE.test(id)) throw orderNotFound();
    const row = await this.baseQuery(executor, organizationId)
      .where('o.id', '=', id)
      .executeTakeFirst();
    if (!row) throw orderNotFound();
    const [shop, payments] = await Promise.all([
      this.shop(executor, organizationId),
      this.payments(executor, organizationId, [id]),
    ]);
    return this.toDto(row, payments.get(id) ?? [], today(shop.timezone));
  }

  /** The order, locked for a change in this transaction. */
  private async lock(trx: Executor, organizationId: string, id: string) {
    if (!UUID_RE.test(id)) throw orderNotFound();
    const row = await trx
      .selectFrom('app.orders')
      .select(['id', 'status', 'fulfilment', 'number'])
      .where('organization_id', '=', organizationId)
      .where('id', '=', id)
      .forUpdate()
      .executeTakeFirst();
    if (!row) throw orderNotFound();
    return row;
  }

  get(organizationId: string, id: string): Promise<OrderDto> {
    return this.find(this.database.db, organizationId, id);
  }

  async list(
    organizationId: string,
    query: OrderListQuery,
  ): Promise<OrderDto[]> {
    const db = this.database.db;
    let q = this.baseQuery(db, organizationId);
    if (query.customerId) {
      if (!UUID_RE.test(query.customerId)) return [];
      q = q.where('o.customer_id', '=', query.customerId);
    }
    q =
      query.state === 'open'
        ? q
            .where('o.status', 'not in', ['delivered', 'cancelled'])
            .orderBy('o.due_on')
            .orderBy(sql`o.due_time nulls last`)
            .orderBy('o.created_at')
        : q
            .where('o.status', 'in', ['delivered', 'cancelled'])
            .orderBy('o.updated_at', 'desc')
            .limit(CLOSED_SHOWN);
    const [rows, shop] = await Promise.all([
      q.execute(),
      this.shop(db, organizationId),
    ]);
    const payments = await this.payments(
      db,
      organizationId,
      rows.map((r) => r.id),
    );
    const day = today(shop.timezone);
    return rows.map((row) => this.toDto(row, payments.get(row.id) ?? [], day));
  }

  async summary(organizationId: string): Promise<OrdersSummaryDto> {
    const db = this.database.db;
    const shop = await this.shop(db, organizationId);
    const day = today(shop.timezone);
    const { rows } = await sql<{
      due_now: string;
      late: string;
      waiting: string;
    }>`
      select count(*) filter (where due_on <= ${day}::date) as due_now,
             count(*) filter (where due_on < ${day}::date) as late,
             count(*) filter (
               where status = 'ready'
                 and updated_at < now() - make_interval(days => ${shop.order_ready_reminder_days})
             ) as waiting
        from app.orders
       where organization_id = ${organizationId}
         and status not in ('delivered', 'cancelled')`.execute(db);
    const row = rows[0]!;
    return {
      dueNow: toNumber(row.due_now),
      late: toNumber(row.late),
      waitingReady: toNumber(row.waiting),
    };
  }

  async create(
    tenant: TenantContext,
    user: AuthContext,
    input: CreateOrderInput,
    requestId: string | null,
  ): Promise<{ order: OrderDto; replayed: boolean }> {
    const organizationId = tenant.organizationId;
    const id = await this.database.db.transaction().execute(async (trx) => {
      const previous = await trx
        .selectFrom('app.orders')
        .select('id')
        .where('organization_id', '=', organizationId)
        .where('client_operation_id', '=', input.clientOperationId)
        .executeTakeFirst();
      if (previous) return { id: previous.id, replayed: true };

      const shop = await this.shop(trx, organizationId);
      // An option the merchant turns on (ADR-072): checked here, not only
      // hidden in the interface.
      if (!shop.orders_enabled)
        throw new ApiException(
          HttpStatus.FORBIDDEN,
          'ORDERS_DISABLED',
          'Les commandes ne sont pas activées pour cette boutique (Paramètres › Mon application).',
        );
      const customer = await trx
        .selectFrom('app.customers')
        .select(['id', 'status'])
        .where('organization_id', '=', organizationId)
        .where('id', '=', input.customerId)
        .executeTakeFirst();
      if (!customer || customer.status !== 'active')
        throw invalid('customerId', 'Client inconnu.');

      const ids = [
        ...new Set(
          input.lines.flatMap((l) => (l.productId ? [l.productId] : [])),
        ),
      ];
      const products = new Map(
        (ids.length === 0
          ? []
          : await trx
              .selectFrom('app.products')
              .select([
                'id',
                'name',
                'unit',
                'sale_price',
                'status',
                'system_role',
                'open_price',
              ])
              .where('organization_id', '=', organizationId)
              .where('id', 'in', ids)
              .execute()
        ).map((p) => [p.id, p]),
      );
      const free = await trx
        .selectFrom('app.products')
        .select(['unit'])
        .where('organization_id', '=', organizationId)
        .where('system_role', '=', 'open_sale')
        .executeTakeFirst();
      if (!free)
        throw new Error(`Shop ${organizationId} has no « Vente au montant »`);

      const lines: StoredOrderLine[] = input.lines.map((line, index) => {
        if (!line.productId)
          return {
            productId: null,
            label: line.label,
            unit: free.unit,
            quantity: line.quantity,
            unitPrice: Math.round(line.agreedTotal! / line.quantity),
            lineTotal: line.agreedTotal!,
            note: line.note,
          };
        const product = products.get(line.productId);
        if (!product || product.status !== 'active' || product.system_role)
          throw invalid(
            `lines.${index}.productId`,
            'Produit inconnu ou archivé.',
          );
        if (product.open_price && line.agreedTotal === null)
          throw invalid(
            `lines.${index}.agreedTotal`,
            `Tapez le prix de « ${product.name} ».`,
          );
        const unitPrice = toNumber(product.sale_price);
        return {
          productId: product.id,
          label: product.name,
          unit: product.unit,
          quantity: line.quantity,
          unitPrice,
          lineTotal: orderLineTotal(unitPrice, line.quantity, line.agreedTotal),
          note: line.note,
        };
      });
      const itemsTotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
      const total = itemsTotal + input.deliveryFee;
      if (input.deposit && input.deposit.amount > total)
        throw invalid(
          'deposit.amount',
          `L’avance ne peut pas dépasser le total (${formatAmount(total, shop.default_currency)}).`,
        );

      const day = today(shop.timezone);
      const next = await takeSequenceNumber(
        trx,
        organizationId,
        'order',
        Number(day.slice(0, 4)),
      );
      const number = `C-${day.slice(0, 4)}-${String(next).padStart(4, '0')}`;
      const { id } = await trx
        .insertInto('app.orders')
        .values({
          organization_id: organizationId,
          number,
          customer_id: input.customerId,
          lines: JSON.stringify(lines),
          items_total: itemsTotal,
          due_on: input.dueOn,
          due_time: input.dueTime,
          fulfilment: input.fulfilment,
          delivery_address: input.deliveryAddress,
          delivery_landmark: input.deliveryLandmark,
          delivery_phone: input.deliveryPhone,
          delivery_fee: input.deliveryFee,
          note: input.note,
          client_operation_id: input.clientOperationId,
          created_by: user.userId,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      if (input.deposit)
        await trx
          .insertInto('app.order_payments')
          .values({
            organization_id: organizationId,
            order_id: id,
            kind: 'deposit',
            method: input.deposit.method,
            provider: input.deposit.provider,
            reference: input.deposit.reference,
            amount: input.deposit.amount,
            client_operation_id: randomUUID(),
            created_by: user.userId,
          })
          .execute();
      await this.audit.record(trx, {
        organizationId,
        actorType: 'user',
        actorId: user.userId,
        action: 'order.created',
        targetType: 'order',
        targetId: id,
        metadata: {
          number,
          total,
          ...(input.deposit ? { deposit: input.deposit.amount } : {}),
        },
        requestId,
      });
      return { id, replayed: false };
    });
    return {
      order: await this.get(organizationId, id.id),
      replayed: id.replayed,
    };
  }

  async receiveDeposit(
    tenant: TenantContext,
    user: AuthContext,
    id: string,
    input: OrderDepositInput,
    requestId: string | null,
  ): Promise<{ order: OrderDto; replayed: boolean }> {
    const organizationId = tenant.organizationId;
    const replayed = await this.database.db
      .transaction()
      .execute(async (trx) => {
        const order = await this.lock(trx, organizationId, id);
        const previous = await trx
          .selectFrom('app.order_payments')
          .select('order_id')
          .where('organization_id', '=', organizationId)
          .where('client_operation_id', '=', input.clientOperationId)
          .executeTakeFirst();
        if (previous) {
          if (previous.order_id !== id)
            throw conflict('OPERATION_REUSED', 'Opération déjà utilisée.');
          return true;
        }
        if (!isOpenOrder(order.status)) throw closed();
        const current = await this.find(trx, organizationId, id);
        const shop = await this.shop(trx, organizationId);
        if (input.amount > current.remaining)
          throw invalid(
            'amount',
            current.remaining === 0
              ? 'Cette commande est déjà toute payée.'
              : `Il reste ${formatAmount(current.remaining, shop.default_currency)} à payer : l’avance ne peut pas dépasser.`,
          );
        await trx
          .insertInto('app.order_payments')
          .values({
            organization_id: organizationId,
            order_id: id,
            kind: 'deposit',
            method: input.method,
            provider: input.provider,
            reference: input.reference,
            amount: input.amount,
            client_operation_id: input.clientOperationId,
            created_by: user.userId,
          })
          .execute();
        await this.audit.record(trx, {
          organizationId,
          actorType: 'user',
          actorId: user.userId,
          action: 'order.deposit_received',
          targetType: 'order',
          targetId: id,
          metadata: {
            number: order.number,
            amount: input.amount,
            method: input.method,
          },
          requestId,
        });
        return false;
      });
    return { order: await this.get(organizationId, id), replayed };
  }

  async setStatus(
    tenant: TenantContext,
    user: AuthContext,
    id: string,
    input: OrderStatusInput,
    requestId: string | null,
  ): Promise<OrderDto> {
    const organizationId = tenant.organizationId;
    await this.database.db.transaction().execute(async (trx) => {
      const order = await this.lock(trx, organizationId, id);
      if (!isOpenOrder(order.status)) throw closed();
      if (
        input.status === 'out_for_delivery' &&
        order.fulfilment !== 'delivery'
      )
        throw invalid(
          'status',
          'Une commande à retirer ne part pas en livraison.',
        );
      if (input.status === order.status) return;
      await trx
        .updateTable('app.orders')
        .set({ status: input.status })
        .where('organization_id', '=', organizationId)
        .where('id', '=', id)
        .execute();
      await this.audit.record(trx, {
        organizationId,
        actorType: 'user',
        actorId: user.userId,
        action: 'order.status_changed',
        targetType: 'order',
        targetId: id,
        metadata: {
          number: order.number,
          from: order.status,
          to: input.status,
        },
        requestId,
      });
    });
    return this.get(organizationId, id);
  }

  /**
   * The handover: an ordinary sale (ticket, stock, statistics, accounts)
   * whose first payments are the deposits, already in the money.
   */
  async deliver(
    tenant: TenantContext,
    user: AuthContext,
    id: string,
    input: DeliverOrderInput,
    requestId: string | null,
  ): Promise<OrderDto> {
    const organizationId = tenant.organizationId;
    if (!roleHasPermission(tenant.role, 'sales.create'))
      throw new ApiException(
        HttpStatus.FORBIDDEN,
        'PERMISSION_DENIED',
        'Seuls ceux qui vendent remettent une commande.',
      );
    const order = await this.get(organizationId, id);
    if (!isOpenOrder(order.status)) {
      // A handover sent twice answers with the order handed over.
      if (order.status === 'delivered') return order;
      throw closed();
    }
    const db = this.database.db;
    const system = async (role: 'open_sale' | 'delivery_fee') => {
      const found = await db
        .selectFrom('app.products')
        .select('id')
        .where('organization_id', '=', organizationId)
        .where('system_role', '=', role)
        .executeTakeFirst();
      if (found) return found.id;
      // The delivery fee is sold as a line of its own (ADR-072).
      const shop = await this.shop(db, organizationId);
      await db
        .insertInto('app.products')
        .values({
          organization_id: organizationId,
          name: 'Frais de livraison',
          unit: shop.offer === 'services' ? 'prestation' : 'piece',
          kind: 'service',
          sale_price: 0,
          track_stock: false,
          open_price: true,
          system_role: role,
          status: 'active',
          client_operation_id: randomUUID(),
          created_by: user.userId,
        })
        .onConflict((oc) =>
          oc
            .columns(['organization_id', 'system_role'])
            .where('system_role', 'is not', null)
            .doNothing(),
        )
        .execute();
      return (
        await db
          .selectFrom('app.products')
          .select('id')
          .where('organization_id', '=', organizationId)
          .where('system_role', '=', role)
          .executeTakeFirstOrThrow()
      ).id;
    };
    const freeId = order.lines.some((l) => !l.productId)
      ? await system('open_sale')
      : null;
    const feeId = order.deliveryFee > 0 ? await system('delivery_fee') : null;

    // Deposits, by way of paying: a sale takes five payments at most.
    const deposits = new Map<string, PaymentInput>();
    for (const p of order.payments) {
      const key = `${p.method}|${p.provider ?? ''}`;
      const sign = p.kind === 'deposit' ? 1 : -1;
      const known = deposits.get(key);
      deposits.set(key, {
        method: p.method,
        provider: p.provider,
        reference: known ? null : p.reference,
        amount: (known?.amount ?? 0) + sign * p.amount,
      });
    }
    const paidBefore = [...deposits.values()].filter((p) => p.amount > 0);
    const payments = [...paidBefore, ...input.payments];
    if (payments.length > 5)
      throw invalid('payments', '5 paiements au plus, avances comprises.');

    const sale: CreateSaleInput = {
      // The order's own id: a handover sent twice records one sale.
      clientOperationId: order.id,
      customerId: order.customer.id,
      lines: [
        ...order.lines.map((line) => ({
          productId: line.productId ?? freeId!,
          productUnitId: null,
          conversion: null,
          quantity: line.quantity,
          agreedTotal: line.lineTotal,
          label: line.productId ? null : line.label,
        })),
        ...(feeId
          ? [
              {
                productId: feeId,
                productUnitId: null,
                conversion: null,
                quantity: 1,
                agreedTotal: order.deliveryFee,
                label: null,
              },
            ]
          : []),
      ],
      discount: 0,
      payments,
      cashReceived: input.cashReceived,
      expectedTotal: order.total,
    };
    await this.sales.create(tenant, user, sale, requestId, undefined, {
      deposits: paidBefore.length,
      onRecorded: async (trx, saleId) => {
        const locked = await this.lock(trx, organizationId, id);
        if (!isOpenOrder(locked.status)) throw closed();
        await trx
          .updateTable('app.orders')
          .set({
            status: 'delivered',
            sale_id: saleId,
            delivered_at: new Date(),
          })
          .where('organization_id', '=', organizationId)
          .where('id', '=', id)
          .execute();
        await this.audit.record(trx, {
          organizationId,
          actorType: 'user',
          actorId: user.userId,
          action: 'order.delivered',
          targetType: 'order',
          targetId: id,
          metadata: { number: order.number, saleId, total: order.total },
          requestId,
        });
      },
    });
    return this.get(organizationId, id);
  }

  /** Cancelled before the handover: the deposit always goes back. */
  async cancel(
    tenant: TenantContext,
    user: AuthContext,
    id: string,
    input: CancelOrderInput,
    requestId: string | null,
  ): Promise<OrderDto> {
    const organizationId = tenant.organizationId;
    await this.database.db.transaction().execute(async (trx) => {
      const order = await this.lock(trx, organizationId, id);
      if (!isOpenOrder(order.status)) throw closed();
      const current = await this.find(trx, organizationId, id);
      if (current.paid > 0) {
        if (!input.refund)
          throw invalid(
            'refund',
            'Dites comment l’avance est rendue au client.',
          );
        await trx
          .insertInto('app.order_payments')
          .values({
            organization_id: organizationId,
            order_id: id,
            kind: 'refund',
            method: input.refund.method,
            provider: input.refund.provider,
            reference: input.refund.reference,
            amount: current.paid,
            client_operation_id: randomUUID(),
            created_by: user.userId,
          })
          .execute();
      }
      await trx
        .updateTable('app.orders')
        .set({
          status: 'cancelled',
          cancelled_at: new Date(),
          cancelled_by: user.userId,
          cancellation_reason: input.reason,
        })
        .where('organization_id', '=', organizationId)
        .where('id', '=', id)
        .execute();
      await this.audit.record(trx, {
        organizationId,
        actorType: 'user',
        actorId: user.userId,
        action: 'order.cancelled',
        targetType: 'order',
        targetId: id,
        metadata: {
          number: order.number,
          reason: input.reason,
          ...(current.paid > 0 ? { refunded: current.paid } : {}),
        },
        requestId,
      });
    });
    return this.get(organizationId, id);
  }
}
