import { HttpStatus, Injectable } from '@nestjs/common';
import {
  MAX_QUANTITY,
  quantityFitsUnit,
  UNITS,
  type CreateStockMovementInput,
  type ProductDto,
  type RecordedStockMovementDto,
  type StockAlertDto,
  type StockMovementDto,
  type StockSummaryDto,
} from '@nagaw/shared';
import { sql } from 'kysely';
import { AuditService } from '../audit/audit.service.js';
import { ApiException } from '../common/api-exception.js';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { DatabaseService } from '../database/database.service.js';
import { pgErrorCode, UNIQUE_VIOLATION } from '../database/pg-errors.js';
import {
  conflict,
  invalid,
  toNullableNumber,
  toNumber,
  UUID_RE,
  type Executor,
} from './catalog.errors.js';
import { ProductsService, productNotFound } from './products.service.js';

/** Latest movements shown on a product page. */
export const MOVEMENTS_SHOWN = 100;

/** Rounds away floating-point noise on quantities with 3 decimals. */
const round3 = (value: number) => Math.round(value * 1000) / 1000;

@Injectable()
export class StockService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
    private readonly products: ProductsService,
  ) {}

  private selectMovements(executor: Executor, organizationId: string) {
    return executor
      .selectFrom('app.stock_movements as m')
      .innerJoin('app.user_profiles as u', 'u.id', 'm.created_by')
      .leftJoin('app.suppliers as s', (join) =>
        join
          .onRef('s.organization_id', '=', 'm.organization_id')
          .onRef('s.id', '=', 'm.supplier_id'),
      )
      .select([
        'm.id',
        'm.kind',
        'm.quantity',
        'm.counted_quantity',
        'm.unit_cost',
        'm.supplier_id',
        's.name as supplier_name',
        'm.reason',
        'm.created_by',
        'u.email as created_by_email',
        'm.occurred_at',
      ])
      .where('m.organization_id', '=', organizationId);
  }

  private toDto(
    row: Awaited<
      ReturnType<ReturnType<StockService['selectMovements']>['execute']>
    >[number],
  ): StockMovementDto {
    return {
      id: row.id,
      kind: row.kind,
      quantity: toNumber(row.quantity),
      countedQuantity: toNullableNumber(row.counted_quantity),
      unitCost: toNullableNumber(row.unit_cost),
      supplier:
        row.supplier_id && row.supplier_name
          ? { id: row.supplier_id, name: row.supplier_name }
          : null,
      reason: row.reason,
      createdBy: { userId: row.created_by, email: row.created_by_email },
      occurredAt: row.occurred_at.toISOString(),
    };
  }

  async movements(
    organizationId: string,
    productId: string,
  ): Promise<StockMovementDto[]> {
    // 404 for a product of another shop, even with no movement.
    await this.products.get(organizationId, productId);
    const rows = await this.selectMovements(this.database.db, organizationId)
      .where('m.product_id', '=', productId)
      .orderBy('m.created_at', 'desc')
      .orderBy('m.id', 'desc')
      .limit(MOVEMENTS_SHOWN)
      .execute();
    return rows.map((row) => this.toDto(row));
  }

  private async findMovement(
    executor: Executor,
    organizationId: string,
    clientOperationId: string,
  ) {
    return this.selectMovements(executor, organizationId)
      .select('m.product_id')
      .where('m.client_operation_id', '=', clientOperationId)
      .executeTakeFirst();
  }

  async record(
    tenant: TenantContext,
    user: AuthContext,
    productId: string,
    input: CreateStockMovementInput,
    requestId: string | null,
  ): Promise<{ result: RecordedStockMovementDto; replayed: boolean }> {
    if (!UUID_RE.test(productId)) throw productNotFound();
    try {
      return await this.database.db.transaction().execute(async (trx) => {
        const product = await this.products.lock(
          trx,
          tenant.organizationId,
          productId,
        );

        // Replay of the same operation: same answer, nothing new.
        const previous = await this.findMovement(
          trx,
          tenant.organizationId,
          input.clientOperationId,
        );
        if (previous) {
          if (previous.product_id !== productId)
            throw conflict(
              'OPERATION_ID_REUSED',
              'Cet identifiant d’opération a déjà servi pour un autre produit.',
            );
          return {
            result: { movement: this.toDto(previous), product },
            replayed: true,
          };
        }

        if (product.status !== 'active')
          throw conflict(
            'PRODUCT_ARCHIVED',
            'Ce produit est archivé : réactivez-le pour modifier son stock.',
          );
        if (!product.trackStock)
          throw conflict(
            'STOCK_NOT_TRACKED',
            'Le stock de ce produit n’est pas suivi.',
          );

        const delta = await this.delta(
          trx,
          tenant.organizationId,
          product,
          input,
        );
        const after = round3(product.stockQuantity + delta);
        if (Math.abs(after) > MAX_QUANTITY)
          throw invalid('quantity', 'Quantité trop grande.');

        const { id } = await trx
          .insertInto('app.stock_movements')
          .values({
            organization_id: tenant.organizationId,
            product_id: productId,
            kind: input.kind,
            quantity: delta,
            counted_quantity:
              input.kind === 'inventory' ? input.countedQuantity : null,
            unit_cost: input.kind === 'purchase' ? input.unitCost : null,
            supplier_id: input.kind === 'purchase' ? input.supplierId : null,
            reason: input.kind === 'purchase' ? null : input.reason,
            client_operation_id: input.clientOperationId,
            created_by: user.userId,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        await this.audit.record(trx, {
          organizationId: tenant.organizationId,
          actorType: 'user',
          actorId: user.userId,
          action: 'stock.moved',
          targetType: 'product',
          targetId: productId,
          metadata: {
            movementId: id,
            kind: input.kind,
            quantity: delta,
            stockBefore: product.stockQuantity,
            stockAfter: after,
          },
          requestId,
        });

        const movement = await this.selectMovements(trx, tenant.organizationId)
          .where('m.id', '=', id)
          .executeTakeFirstOrThrow();
        return {
          result: {
            movement: this.toDto(movement),
            product: await this.products.find(
              trx,
              tenant.organizationId,
              productId,
            ),
          },
          replayed: false,
        };
      });
    } catch (error) {
      // Two devices sent the same operation at once: answer like a replay.
      if (pgErrorCode(error) === UNIQUE_VIOLATION) {
        const previous = await this.findMovement(
          this.database.db,
          tenant.organizationId,
          input.clientOperationId,
        );
        if (previous?.product_id === productId) {
          return {
            result: {
              movement: this.toDto(previous),
              product: await this.products.get(
                tenant.organizationId,
                productId,
              ),
            },
            replayed: true,
          };
        }
      }
      throw error;
    }
  }

  /** Signed change of the stock for a movement entered by a person. */
  private async delta(
    executor: Executor,
    organizationId: string,
    product: ProductDto,
    input: CreateStockMovementInput,
  ): Promise<number> {
    const unitLabel = UNITS[product.unit].label;
    const quantity =
      input.kind === 'inventory' ? input.countedQuantity : input.quantity;
    if (!quantityFitsUnit(quantity, product.unit))
      throw invalid(
        input.kind === 'inventory' ? 'countedQuantity' : 'quantity',
        `Nombre entier attendu (unité : ${unitLabel}).`,
      );

    switch (input.kind) {
      case 'purchase': {
        if (input.supplierId) {
          const supplier = await executor
            .selectFrom('app.suppliers')
            .select('id')
            .where('organization_id', '=', organizationId)
            .where('id', '=', input.supplierId)
            .where('status', '=', 'active')
            .executeTakeFirst();
          if (!supplier) throw invalid('supplierId', 'Fournisseur inconnu.');
        }
        return input.quantity;
      }
      case 'loss':
        if (input.quantity > product.stockQuantity)
          throw new ApiException(
            HttpStatus.CONFLICT,
            'STOCK_INSUFFICIENT',
            `Il ne reste que ${new Intl.NumberFormat('fr').format(Math.max(product.stockQuantity, 0))} ${unitLabel} en stock. Faites un inventaire si ce chiffre est faux.`,
          );
        return -input.quantity;
      case 'inventory':
        return round3(input.countedQuantity - product.stockQuantity);
    }
  }

  async summary(organizationId: string): Promise<StockSummaryDto> {
    const stock = sql<number>`coalesce(s.quantity, 0)`;
    const row = await this.database.db
      .selectFrom('app.products as p')
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
        sql<string>`count(*) filter (where p.track_stock)`.as('tracked'),
        sql<string>`count(*) filter (where p.track_stock and ${stock} <= 0)`.as(
          'out',
        ),
        sql<string>`count(*) filter (where p.track_stock and ${stock} > 0 and p.low_stock_threshold is not null and ${stock} <= p.low_stock_threshold)`.as(
          'low',
        ),
        sql<string>`coalesce(round(sum(${stock} * p.purchase_price) filter (where p.track_stock and ${stock} > 0)), 0)`.as(
          'value',
        ),
        sql<string>`count(*) filter (where p.track_stock and ${stock} > 0 and p.purchase_price is null)`.as(
          'unvalued',
        ),
      ])
      .where('p.organization_id', '=', organizationId)
      .where('p.status', '=', 'active')
      .executeTakeFirstOrThrow();

    const alerts: StockAlertDto[] = (
      await this.products.list(organizationId, {
        stock: 'low',
        status: 'active',
      })
    )
      .sort(
        (a, b) =>
          (a.stockLevel === 'out' ? 0 : 1) - (b.stockLevel === 'out' ? 0 : 1) ||
          a.stockQuantity - b.stockQuantity,
      )
      .slice(0, 10)
      .map((p) => ({
        id: p.id,
        name: p.name,
        unit: p.unit,
        stockQuantity: p.stockQuantity,
        lowStockThreshold: p.lowStockThreshold,
        stockLevel: p.stockLevel === 'out' ? 'out' : 'low',
      }));

    return {
      trackedProducts: Number(row.tracked),
      lowStock: Number(row.low),
      outOfStock: Number(row.out),
      stockValue: Number(row.value),
      unvaluedProducts: Number(row.unvalued),
      alerts,
    };
  }
}
