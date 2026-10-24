import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  computeSaleTotals,
  formatAmount,
  paymentProblem,
  quantityFitsUnit,
  roleHasPermission,
  UNITS,
  type CancelSaleInput,
  type CreateSaleInput,
  type PaymentMethod,
  type SaleDto,
  type SaleListItemDto,
  type SalesDaySummaryDto,
} from '@nagaw/shared';
import { sql } from 'kysely';
import { AuditService } from '../audit/audit.service.js';
import { ApiException } from '../common/api-exception.js';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { today } from '../common/today.js';
import { DatabaseService } from '../database/database.service.js';
import { pgErrorCode, UNIQUE_VIOLATION } from '../database/pg-errors.js';
import {
  conflict,
  invalid,
  notFound,
  toNullableNumber,
  toNumber,
  UUID_RE,
  type Executor,
} from '../catalog/catalog.errors.js';
import { balances } from './customers.service.js';

function saleNotFound(): ApiException {
  return notFound('SALE_NOT_FOUND', 'Vente introuvable.');
}

/** Sellers only see their own sales; managers and the reader see all. */
function sellerScope(tenant: TenantContext, user: AuthContext): string | null {
  return roleHasPermission(tenant.role, 'sales.read_all') ? null : user.userId;
}

@Injectable()
export class SalesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  // -------------------------------------------------------------------------
  // Reading
  // -------------------------------------------------------------------------

  private async find(
    executor: Executor,
    organizationId: string,
    id: string,
    sellerId: string | null,
  ): Promise<SaleDto> {
    if (!UUID_RE.test(id)) throw saleNotFound();
    let query = executor
      .selectFrom('app.sales as s')
      .innerJoin('app.user_profiles as u', 'u.id', 's.seller_id')
      .leftJoin('app.user_profiles as x', 'x.id', 's.cancelled_by')
      .leftJoin('app.customers as c', (join) =>
        join
          .onRef('c.organization_id', '=', 's.organization_id')
          .onRef('c.id', '=', 's.customer_id'),
      )
      .selectAll('s')
      .select([
        'u.email as seller_email',
        'x.email as cancelled_by_email',
        'c.name as customer_name',
        'c.phone as customer_phone',
      ])
      .where('s.organization_id', '=', organizationId)
      .where('s.id', '=', id);
    if (sellerId) query = query.where('s.seller_id', '=', sellerId);
    const sale = await query.executeTakeFirst();
    if (!sale) throw saleNotFound();

    const [lines, payments] = await Promise.all([
      executor
        .selectFrom('app.sale_lines')
        .selectAll()
        .where('organization_id', '=', organizationId)
        .where('sale_id', '=', id)
        .orderBy('position')
        .execute(),
      executor
        .selectFrom('app.sale_payments')
        .selectAll()
        .where('organization_id', '=', organizationId)
        .where('sale_id', '=', id)
        .orderBy('id')
        .execute(),
    ]);
    return {
      id: sale.id,
      saleNumber: sale.sale_number,
      status: sale.status,
      customer:
        sale.customer_id && sale.customer_name !== null
          ? {
              id: sale.customer_id,
              name: sale.customer_name,
              phone: sale.customer_phone ?? '',
            }
          : null,
      seller: { userId: sale.seller_id, email: sale.seller_email },
      lines: lines.map((line) => ({
        position: line.position,
        productId: line.product_id,
        label: line.label,
        unit: line.unit,
        unitPrice: toNumber(line.unit_price),
        quantity: toNumber(line.quantity),
        lineTotal: toNumber(line.line_total),
        taxRateBasisPoints: line.tax_rate_basis_points,
        taxAmount: toNumber(line.tax_amount),
      })),
      payments: payments.map((payment) => ({
        method: payment.method,
        provider: payment.provider,
        reference: payment.reference,
        amount: toNumber(payment.amount),
      })),
      subtotal: toNumber(sale.subtotal),
      discount: toNumber(sale.discount),
      total: toNumber(sale.total),
      taxTotal: toNumber(sale.tax_total),
      cashReceived: toNullableNumber(sale.cash_received),
      changeGiven: toNullableNumber(sale.change_given),
      occurredAt: sale.occurred_at.toISOString(),
      cancellation:
        sale.cancelled_at && sale.cancelled_by && sale.cancel_reason
          ? {
              at: sale.cancelled_at.toISOString(),
              by: {
                userId: sale.cancelled_by,
                email: sale.cancelled_by_email ?? '',
              },
              reason: sale.cancel_reason,
            }
          : null,
    };
  }

  get(tenant: TenantContext, user: AuthContext, id: string): Promise<SaleDto> {
    return this.find(
      this.database.db,
      tenant.organizationId,
      id,
      sellerScope(tenant, user),
    );
  }

  /** Bounds of a calendar day in the shop's time zone. */
  private async dayOf(organizationId: string, day: string | undefined) {
    const { timezone } = await this.database.db
      .selectFrom('app.organizations')
      .select('timezone')
      .where('id', '=', organizationId)
      .executeTakeFirstOrThrow();
    return { day: day ?? today(timezone), timezone };
  }

  async list(
    tenant: TenantContext,
    user: AuthContext,
    day?: string,
  ): Promise<SaleListItemDto[]> {
    const bounds = await this.dayOf(tenant.organizationId, day);
    const sellerId = sellerScope(tenant, user);
    let query = this.database.db
      .selectFrom('app.sales as s')
      .innerJoin('app.user_profiles as u', 'u.id', 's.seller_id')
      .leftJoin('app.customers as c', (join) =>
        join
          .onRef('c.organization_id', '=', 's.organization_id')
          .onRef('c.id', '=', 's.customer_id'),
      )
      .select([
        's.id',
        's.sale_number',
        's.status',
        's.total',
        's.occurred_at',
        'u.email as seller_email',
        'c.name as customer_name',
      ])
      .select([
        sql<string>`(select count(*) from app.sale_lines l where l.organization_id = s.organization_id and l.sale_id = s.id)`.as(
          'item_count',
        ),
        sql<
          PaymentMethod[]
        >`(select array_agg(distinct p.method) from app.sale_payments p where p.organization_id = s.organization_id and p.sale_id = s.id)`.as(
          'methods',
        ),
      ])
      .where('s.organization_id', '=', tenant.organizationId)
      .where(
        sql<string>`(s.occurred_at at time zone ${bounds.timezone})::date::text`,
        '=',
        bounds.day,
      )
      .orderBy('s.occurred_at', 'desc')
      .limit(500);
    if (sellerId) query = query.where('s.seller_id', '=', sellerId);
    return (await query.execute()).map((row) => ({
      id: row.id,
      saleNumber: row.sale_number,
      status: row.status,
      customerName: row.customer_name,
      sellerEmail: row.seller_email,
      itemCount: Number(row.item_count),
      total: toNumber(row.total),
      methods: row.methods ?? [],
      occurredAt: row.occurred_at.toISOString(),
    }));
  }

  async summary(
    tenant: TenantContext,
    user: AuthContext,
    day?: string,
  ): Promise<SalesDaySummaryDto> {
    const bounds = await this.dayOf(tenant.organizationId, day);
    const sellerId = sellerScope(tenant, user);
    const onDay = sql<string>`(s.occurred_at at time zone ${bounds.timezone})::date::text`;
    let sales = this.database.db
      .selectFrom('app.sales as s')
      .select([
        sql<string>`count(*) filter (where s.status = 'completed')`.as('count'),
        sql<string>`coalesce(sum(s.total) filter (where s.status = 'completed'), 0)`.as(
          'total',
        ),
        sql<string>`count(*) filter (where s.status = 'cancelled')`.as(
          'cancelled',
        ),
      ])
      .where('s.organization_id', '=', tenant.organizationId)
      .where(onDay, '=', bounds.day);
    let methods = this.database.db
      .selectFrom('app.sale_payments as p')
      .innerJoin('app.sales as s', (join) =>
        join
          .onRef('s.organization_id', '=', 'p.organization_id')
          .onRef('s.id', '=', 'p.sale_id'),
      )
      .select(['p.method'])
      .select((eb) => eb.fn.sum<string>('p.amount').as('amount'))
      .where('s.organization_id', '=', tenant.organizationId)
      .where('s.status', '=', 'completed')
      .where(onDay, '=', bounds.day)
      .groupBy('p.method');
    if (sellerId) {
      sales = sales.where('s.seller_id', '=', sellerId);
      methods = methods.where('s.seller_id', '=', sellerId);
    }
    const [totals, byMethodRows] = await Promise.all([
      sales.executeTakeFirstOrThrow(),
      methods.execute(),
    ]);
    const byMethod: Record<PaymentMethod, number> = {
      cash: 0,
      mobile_money: 0,
      card: 0,
      credit: 0,
    };
    for (const row of byMethodRows) byMethod[row.method] = toNumber(row.amount);
    return {
      day: bounds.day,
      count: Number(totals.count),
      total: toNumber(totals.total),
      byMethod,
      cancelledCount: Number(totals.cancelled),
    };
  }

  // -------------------------------------------------------------------------
  // Recording a sale
  // -------------------------------------------------------------------------

  async create(
    tenant: TenantContext,
    user: AuthContext,
    input: CreateSaleInput,
    requestId: string | null,
  ): Promise<{ sale: SaleDto; replayed: boolean }> {
    try {
      return await this.database.db.transaction().execute(async (trx) => {
        // Serializes the sales of a shop: ticket numbers have no gap.
        const org = await trx
          .selectFrom('app.organizations')
          .select([
            'next_sale_number',
            'seller_max_discount_basis_points',
            'default_currency',
          ])
          .where('id', '=', tenant.organizationId)
          .forUpdate()
          .executeTakeFirstOrThrow();

        const previous = await trx
          .selectFrom('app.sales')
          .select('id')
          .where('organization_id', '=', tenant.organizationId)
          .where('client_operation_id', '=', input.clientOperationId)
          .executeTakeFirst();
        if (previous)
          return {
            sale: await this.find(
              trx,
              tenant.organizationId,
              previous.id,
              null,
            ),
            replayed: true,
          };

        // Prices come from the catalogue, never from the device.
        const ids = [...new Set(input.lines.map((line) => line.productId))];
        const products = await trx
          .selectFrom('app.products as p')
          .leftJoin('app.tax_rates as t', (join) =>
            join
              .onRef('t.organization_id', '=', 'p.organization_id')
              .onRef('t.id', '=', 'p.tax_rate_id'),
          )
          .select([
            'p.id',
            'p.name',
            'p.unit',
            'p.sale_price',
            'p.track_stock',
            'p.status',
            't.rate_basis_points',
          ])
          .where('p.organization_id', '=', tenant.organizationId)
          .where('p.id', 'in', ids)
          .execute();
        const byId = new Map(products.map((p) => [p.id, p]));
        const lines = input.lines.map((line, index) => {
          const product = byId.get(line.productId);
          if (!product || product.status !== 'active')
            throw invalid(
              `lines.${index}.productId`,
              'Produit inconnu ou archivé.',
            );
          if (!quantityFitsUnit(line.quantity, product.unit))
            throw invalid(
              `lines.${index}.quantity`,
              `Nombre entier attendu pour « ${product.name} » (${UNITS[product.unit].label}).`,
            );
          return { line, product };
        });

        const totals = computeSaleTotals(
          lines.map(({ line, product }) => ({
            unitPrice: toNumber(product.sale_price),
            quantity: line.quantity,
            taxRateBasisPoints: product.rate_basis_points,
          })),
          input.discount,
        );
        if (input.discount > totals.subtotal)
          throw invalid(
            'discount',
            'La remise dépasse le montant de la vente.',
          );
        if (totals.total !== input.expectedTotal)
          throw new ApiException(
            HttpStatus.CONFLICT,
            'PRICE_CHANGED',
            `Les prix ont changé : le total est maintenant de ${formatAmount(totals.total, org.default_currency)}.`,
            [{ path: 'expectedTotal', message: String(totals.total) }],
          );
        if (
          !roleHasPermission(tenant.role, 'sales.cancel') &&
          totals.subtotal > 0 &&
          input.discount * 10000 >
            totals.subtotal * org.seller_max_discount_basis_points
        )
          throw new ApiException(
            HttpStatus.FORBIDDEN,
            'DISCOUNT_NOT_ALLOWED',
            `Une remise de plus de ${org.seller_max_discount_basis_points / 100} % doit être faite par le propriétaire ou un gérant.`,
          );

        const problem = paymentProblem({
          total: totals.total,
          payments: input.payments,
          cashReceived: input.cashReceived,
          customerId: input.customerId,
        });
        if (problem) throw invalid(problem.path, problem.message);
        await this.assertCustomer(
          trx,
          tenant.organizationId,
          input,
          org.default_currency,
        );

        const cash = input.payments
          .filter((p) => p.method === 'cash')
          .reduce((sum, p) => sum + p.amount, 0);
        const { id } = await trx
          .insertInto('app.sales')
          .values({
            organization_id: tenant.organizationId,
            sale_number: org.next_sale_number,
            customer_id: input.customerId,
            seller_id: user.userId,
            subtotal: totals.subtotal,
            discount: totals.discount,
            total: totals.total,
            tax_total: totals.taxTotal,
            cash_received: input.cashReceived,
            change_given:
              input.cashReceived === null ? null : input.cashReceived - cash,
            client_operation_id: input.clientOperationId,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        await trx
          .updateTable('app.organizations')
          .set({ next_sale_number: org.next_sale_number + 1 })
          .where('id', '=', tenant.organizationId)
          .execute();
        await trx
          .insertInto('app.sale_lines')
          .values(
            lines.map(({ line, product }, index) => ({
              organization_id: tenant.organizationId,
              sale_id: id,
              position: index + 1,
              product_id: product.id,
              label: product.name,
              unit: product.unit,
              unit_price: toNumber(product.sale_price),
              quantity: line.quantity,
              line_total: totals.lines[index]!.lineTotal,
              tax_rate_basis_points: product.rate_basis_points,
              tax_amount: totals.lines[index]!.taxAmount,
            })),
          )
          .execute();
        await trx
          .insertInto('app.sale_payments')
          .values(
            input.payments.map((payment) => ({
              organization_id: tenant.organizationId,
              sale_id: id,
              method: payment.method,
              provider: payment.provider,
              reference: payment.reference,
              amount: payment.amount,
            })),
          )
          .execute();
        // The goods leave the stock, even below zero: the sale already
        // happened at the counter; the product then shows « Épuisé ».
        const tracked = lines.filter(({ product }) => product.track_stock);
        if (tracked.length > 0)
          await trx
            .insertInto('app.stock_movements')
            .values(
              tracked.map(({ line, product }) => ({
                organization_id: tenant.organizationId,
                product_id: product.id,
                kind: 'sale' as const,
                quantity: -line.quantity,
                sale_id: id,
                client_operation_id: randomUUID(),
                created_by: user.userId,
              })),
            )
            .execute();
        await this.audit.record(trx, {
          organizationId: tenant.organizationId,
          actorType: 'user',
          actorId: user.userId,
          action: 'sale.completed',
          targetType: 'sale',
          targetId: id,
          metadata: {
            saleNumber: org.next_sale_number,
            total: totals.total,
            discount: totals.discount,
            methods: [...new Set(input.payments.map((p) => p.method))],
          },
          requestId,
        });
        return {
          sale: await this.find(trx, tenant.organizationId, id, null),
          replayed: false,
        };
      });
    } catch (error) {
      if (pgErrorCode(error) === UNIQUE_VIOLATION) {
        // The same sale arrived twice at once: answer like a replay.
        const previous = await this.database.db
          .selectFrom('app.sales')
          .select('id')
          .where('organization_id', '=', tenant.organizationId)
          .where('client_operation_id', '=', input.clientOperationId)
          .executeTakeFirst();
        if (previous)
          return {
            sale: await this.find(
              this.database.db,
              tenant.organizationId,
              previous.id,
              null,
            ),
            replayed: true,
          };
      }
      throw error;
    }
  }

  /** Customer of the same shop; on credit, within its credit limit. */
  private async assertCustomer(
    executor: Executor,
    organizationId: string,
    input: CreateSaleInput,
    currency: string,
  ): Promise<void> {
    if (!input.customerId) return;
    const customer = await executor
      .selectFrom('app.customers as c')
      .innerJoin(
        balances(executor, organizationId).as('b'),
        'b.customer_id',
        'c.id',
      )
      .select(['c.id', 'c.status', 'c.credit_limit', 'b.balance'])
      .where('c.organization_id', '=', organizationId)
      .where('c.id', '=', input.customerId)
      .forUpdate(['c'])
      .executeTakeFirst();
    if (!customer || customer.status !== 'active')
      throw invalid('customerId', 'Client inconnu.');
    const credit = input.payments
      .filter((p) => p.method === 'credit')
      .reduce((sum, p) => sum + p.amount, 0);
    const limit = toNullableNumber(customer.credit_limit);
    if (
      credit > 0 &&
      limit !== null &&
      toNumber(customer.balance) + credit > limit
    )
      throw conflict(
        'CREDIT_LIMIT_EXCEEDED',
        `Ce client ne peut pas devoir plus de ${formatAmount(limit, currency)} (il doit déjà ${formatAmount(toNumber(customer.balance), currency)}).`,
      );
  }

  // -------------------------------------------------------------------------
  // Cancelling a sale
  // -------------------------------------------------------------------------

  async cancel(
    tenant: TenantContext,
    user: AuthContext,
    id: string,
    input: CancelSaleInput,
    requestId: string | null,
  ): Promise<SaleDto> {
    if (!UUID_RE.test(id)) throw saleNotFound();
    return this.database.db.transaction().execute(async (trx) => {
      const sale = await trx
        .selectFrom('app.sales')
        .select(['id', 'status', 'sale_number', 'total'])
        .where('organization_id', '=', tenant.organizationId)
        .where('id', '=', id)
        .forUpdate()
        .executeTakeFirst();
      if (!sale) throw saleNotFound();
      if (sale.status === 'cancelled')
        throw conflict(
          'SALE_ALREADY_CANCELLED',
          'Cette vente est déjà annulée.',
        );
      await trx
        .updateTable('app.sales')
        .set({
          status: 'cancelled',
          cancelled_at: new Date(),
          cancelled_by: user.userId,
          cancel_reason: input.reason,
        })
        .where('organization_id', '=', tenant.organizationId)
        .where('id', '=', id)
        .execute();
      // The goods come back to the stock they left.
      const sold = await trx
        .selectFrom('app.stock_movements')
        .select(['product_id', 'quantity'])
        .where('organization_id', '=', tenant.organizationId)
        .where('sale_id', '=', id)
        .where('kind', '=', 'sale')
        .execute();
      if (sold.length > 0)
        await trx
          .insertInto('app.stock_movements')
          .values(
            sold.map((movement) => ({
              organization_id: tenant.organizationId,
              product_id: movement.product_id,
              kind: 'return' as const,
              quantity: -toNumber(movement.quantity),
              sale_id: id,
              reason: `Vente n° ${sale.sale_number} annulée`,
              client_operation_id: randomUUID(),
              created_by: user.userId,
            })),
          )
          .execute();
      await this.audit.record(trx, {
        organizationId: tenant.organizationId,
        actorType: 'user',
        actorId: user.userId,
        action: 'sale.cancelled',
        targetType: 'sale',
        targetId: id,
        metadata: {
          saleNumber: sale.sale_number,
          total: toNumber(sale.total),
          reason: input.reason,
        },
        requestId,
      });
      return this.find(trx, tenant.organizationId, id, null);
    });
  }
}
