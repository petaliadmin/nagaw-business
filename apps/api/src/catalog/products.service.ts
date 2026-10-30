import { createHash } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  PRODUCT_PHOTO_MAX_BYTES,
  quantityFitsUnit,
  stockLevel,
  type CreateProductInput,
  type CreateProductUnitInput,
  type ProductDto,
  type ProductListQuery,
  type ProductPhotoType,
  type ProductUnitDto,
  type Unit,
  type UpdateProductInput,
  type UpdateProductUnitInput,
} from '@nagaw/shared';
import { sql, type Transaction } from 'kysely';
import { AuditService } from '../audit/audit.service.js';
import { pageOf } from '../common/page.js';
import { ApiException } from '../common/api-exception.js';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { DatabaseService } from '../database/database.service.js';
import { pgErrorCode, UNIQUE_VIOLATION } from '../database/pg-errors.js';
import type { Database } from '../database/schema.js';
import {
  conflict,
  invalid,
  limitReached,
  lockOrganization,
  notFound,
  toNullableNumber,
  toNumber,
  UUID_RE,
  type Executor,
} from './catalog.errors.js';

export function productNotFound(): ApiException {
  return notFound('PRODUCT_NOT_FOUND', 'Produit introuvable.');
}

function unitNotFound(): ApiException {
  return notFound('PRODUCT_UNIT_NOT_FOUND', 'Unité de vente introuvable.');
}

function barcodeTaken(): ApiException {
  return conflict('BARCODE_TAKEN', 'Un produit porte déjà ce code-barres.');
}

/** Name or barcode already used by an active product of the shop. */
function translateUnique(error: unknown): unknown {
  if (pgErrorCode(error) !== UNIQUE_VIOLATION) return error;
  const constraint = (error as { constraint?: string }).constraint ?? '';
  if (constraint.includes('barcode')) return barcodeTaken();
  if (constraint.includes('label'))
    return conflict('NAME_TAKEN', 'Ce produit a déjà une unité de ce nom.');
  if (constraint.includes('name'))
    return conflict('NAME_TAKEN', 'Un produit porte déjà ce nom.');
  return error;
}

interface UnitRow {
  id: string;
  label: string;
  factor: number | string;
  sale_price: number | string | null;
  allows_decimals: boolean;
  barcode: string | null;
  status: 'active' | 'archived';
  version: number;
}

function unitToDto(row: UnitRow): ProductUnitDto {
  return {
    id: row.id,
    label: row.label,
    factor: toNumber(row.factor),
    salePrice: toNullableNumber(row.sale_price),
    allowsDecimals: row.allows_decimals,
    barcode: row.barcode,
    status: row.status,
    version: row.version,
  };
}

/** Image type from its first bytes; the declared type is never trusted. */
export function detectImageType(data: Buffer): ProductPhotoType | null {
  if (
    data.length >= 3 &&
    data[0] === 0xff &&
    data[1] === 0xd8 &&
    data[2] === 0xff
  )
    return 'image/jpeg';
  if (
    data.length >= 8 &&
    data
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return 'image/png';
  if (
    data.length >= 12 &&
    data.subarray(0, 4).toString('latin1') === 'RIFF' &&
    data.subarray(8, 12).toString('latin1') === 'WEBP'
  )
    return 'image/webp';
  return null;
}

/** Characters with a meaning in LIKE patterns are searched literally. */
function likePattern(text: string): string {
  return `%${text.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  /** Products of one shop, with category, tax rate and computed stock. */
  private select(executor: Executor, organizationId: string) {
    return executor
      .selectFrom('app.products as p')
      .leftJoin('app.product_categories as c', (join) =>
        join
          .onRef('c.organization_id', '=', 'p.organization_id')
          .onRef('c.id', '=', 'p.category_id'),
      )
      .leftJoin('app.tax_rates as t', (join) =>
        join
          .onRef('t.organization_id', '=', 'p.organization_id')
          .onRef('t.id', '=', 'p.tax_rate_id'),
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
        'p.category_id',
        'c.name as category_name',
        'c.color as category_color',
        'p.unit',
        'p.sale_price',
        'p.purchase_price',
        'p.tax_rate_id',
        't.name as tax_rate_name',
        't.rate_basis_points',
        'p.barcode',
        'p.kind',
        'p.track_stock',
        'p.low_stock_threshold',
        'p.status',
        'p.version',
        'p.photo_sha256',
        'p.created_at',
        'p.updated_at',
      ])
      .select(sql<string>`coalesce(s.quantity, 0)`.as('stock_quantity'))
      .select(
        sql<UnitRow[]>`coalesce((
          select json_agg(json_build_object(
                   'id', u.id, 'label', u.label, 'factor', u.factor,
                   'sale_price', u.sale_price, 'allows_decimals', u.allows_decimals,
                   'barcode', u.barcode, 'status', u.status, 'version', u.version)
                 order by u.factor, lower(u.label))
            from app.product_units u
           where u.organization_id = p.organization_id and u.product_id = p.id
             and u.status = 'active'), '[]'::json)`.as('units'),
      )
      .where('p.organization_id', '=', organizationId);
  }

  private toDto(
    row: Awaited<
      ReturnType<ReturnType<ProductsService['select']>['execute']>
    >[number],
  ): ProductDto {
    const stock = {
      trackStock: row.track_stock,
      stockQuantity: toNumber(row.stock_quantity),
      lowStockThreshold: toNullableNumber(row.low_stock_threshold),
    };
    return {
      id: row.id,
      name: row.name,
      kind: row.kind,
      category:
        row.category_id && row.category_name && row.category_color
          ? {
              id: row.category_id,
              name: row.category_name,
              color: row.category_color,
            }
          : null,
      unit: row.unit,
      salePrice: toNumber(row.sale_price),
      purchasePrice: toNullableNumber(row.purchase_price),
      taxRate:
        row.tax_rate_id && row.tax_rate_name && row.rate_basis_points !== null
          ? {
              id: row.tax_rate_id,
              name: row.tax_rate_name,
              rateBasisPoints: row.rate_basis_points,
            }
          : null,
      barcode: row.barcode,
      ...stock,
      stockLevel: stockLevel(stock),
      status: row.status,
      version: row.version,
      photoVersion: row.photo_sha256?.slice(0, 16) ?? null,
      units: row.units.map(unitToDto),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  async list(
    organizationId: string,
    query: ProductListQuery,
  ): Promise<ProductDto[]> {
    let q = this.select(this.database.db, organizationId)
      .where('p.status', '=', query.status)
      .orderBy(sql`lower(p.name)`)
      .orderBy('p.id');
    if (query.categoryId) q = q.where('p.category_id', '=', query.categoryId);
    if (query.kind) q = q.where('p.kind', '=', query.kind);
    if (query.q) {
      const text = query.q;
      q = q.where((eb) =>
        eb.or([
          eb(sql`lower(p.name)`, 'like', likePattern(text)),
          eb('p.barcode', '=', text),
          // The barcode of a pack (« paquet », « carton ») finds its product.
          eb.exists(
            eb
              .selectFrom('app.product_units as u')
              .select('u.id')
              .whereRef('u.organization_id', '=', 'p.organization_id')
              .whereRef('u.product_id', '=', 'p.id')
              .where('u.status', '=', 'active')
              .where('u.barcode', '=', text),
          ),
        ]),
      );
    }
    if (query.stock) {
      const stock = sql`coalesce(s.quantity, 0)`;
      q = q.where('p.track_stock', '=', true);
      q =
        query.stock === 'out'
          ? q.where(stock, '<=', 0)
          : q.where((eb) =>
              eb.or([
                eb(stock, '<=', 0),
                eb.and([
                  eb('p.low_stock_threshold', 'is not', null),
                  eb(stock, '<=', eb.ref('p.low_stock_threshold')),
                ]),
              ]),
            );
    }
    return (await pageOf(q, query, 500).execute()).map((row) =>
      this.toDto(row),
    );
  }

  async find(
    executor: Executor,
    organizationId: string,
    id: string,
  ): Promise<ProductDto> {
    if (!UUID_RE.test(id)) throw productNotFound();
    const row = await this.select(executor, organizationId)
      .where('p.id', '=', id)
      .executeTakeFirst();
    if (!row) throw productNotFound();
    return this.toDto(row);
  }

  get(organizationId: string, id: string): Promise<ProductDto> {
    return this.find(this.database.db, organizationId, id);
  }

  /** Locks the product row of this shop (serializes its stock changes). */
  async lock(
    trx: Transaction<Database>,
    organizationId: string,
    id: string,
  ): Promise<ProductDto> {
    if (!UUID_RE.test(id)) throw productNotFound();
    const locked = await trx
      .selectFrom('app.products')
      .select('id')
      .where('organization_id', '=', organizationId)
      .where('id', '=', id)
      .forUpdate()
      .executeTakeFirst();
    if (!locked) throw productNotFound();
    return this.find(trx, organizationId, id);
  }

  /** Category and tax rate must be active ones of the same shop. */
  private async assertReferences(
    executor: Executor,
    organizationId: string,
    input: { categoryId?: string | null; taxRateId?: string | null },
  ): Promise<void> {
    if (input.categoryId) {
      const category = await executor
        .selectFrom('app.product_categories')
        .select('id')
        .where('organization_id', '=', organizationId)
        .where('id', '=', input.categoryId)
        .where('status', '=', 'active')
        .executeTakeFirst();
      if (!category) throw invalid('categoryId', 'Catégorie inconnue.');
    }
    if (input.taxRateId) {
      const taxRate = await executor
        .selectFrom('app.tax_rates')
        .select('id')
        .where('organization_id', '=', organizationId)
        .where('id', '=', input.taxRateId)
        .where('status', '=', 'active')
        .executeTakeFirst();
      if (!taxRate) throw invalid('taxRateId', 'Taxe inconnue.');
    }
  }

  /**
   * A barcode names one product or one of its selling units in the shop.
   * Each table keeps its own barcodes unique; this checks the other one.
   */
  private async assertBarcodeFree(
    executor: Executor,
    organizationId: string,
    barcode: string | null | undefined,
    except: { productId?: string; unitId?: string },
  ): Promise<void> {
    if (!barcode) return;
    let products = executor
      .selectFrom('app.products')
      .select('id')
      .where('organization_id', '=', organizationId)
      .where('status', '=', 'active')
      .where('barcode', '=', barcode);
    if (except.productId)
      products = products.where('id', '<>', except.productId);
    let units = executor
      .selectFrom('app.product_units')
      .select('id')
      .where('organization_id', '=', organizationId)
      .where('status', '=', 'active')
      .where('barcode', '=', barcode);
    if (except.unitId) units = units.where('id', '<>', except.unitId);
    const [product, unit] = await Promise.all([
      products.executeTakeFirst(),
      units.executeTakeFirst(),
    ]);
    if (product || unit) throw barcodeTaken();
  }

  private assertQuantityFitsUnit(
    path: string,
    quantity: number | null | undefined,
    unit: Unit,
  ): void {
    if (
      quantity !== null &&
      quantity !== undefined &&
      !quantityFitsUnit(quantity, unit)
    )
      throw invalid(path, 'Nombre entier attendu pour cette unité.');
  }

  async create(
    tenant: TenantContext,
    user: AuthContext,
    input: CreateProductInput,
    requestId: string | null,
  ): Promise<{ product: ProductDto; replayed: boolean }> {
    this.assertQuantityFitsUnit('initialStock', input.initialStock, input.unit);
    this.assertQuantityFitsUnit(
      'lowStockThreshold',
      input.lowStockThreshold,
      input.unit,
    );
    try {
      return await this.database.db.transaction().execute(async (trx) => {
        const org = await lockOrganization(trx, tenant.organizationId);
        // Replay of the same creation (offline queue, double tap).
        const existing = await trx
          .selectFrom('app.products')
          .select('id')
          .where('organization_id', '=', tenant.organizationId)
          .where('client_operation_id', '=', input.clientOperationId)
          .executeTakeFirst();
        if (existing) {
          return {
            product: await this.find(trx, tenant.organizationId, existing.id),
            replayed: true,
          };
        }

        const { count } = await trx
          .selectFrom('app.products')
          .select((eb) => eb.fn.countAll<string>().as('count'))
          .where('organization_id', '=', tenant.organizationId)
          .where('status', '=', 'active')
          .executeTakeFirstOrThrow();
        if (org.max_products !== null && Number(count) >= org.max_products)
          throw limitReached('produits', org.max_products, true);
        await this.assertReferences(trx, tenant.organizationId, input);
        await this.assertBarcodeFree(
          trx,
          tenant.organizationId,
          input.barcode,
          {},
        );

        const { id } = await trx
          .insertInto('app.products')
          .values({
            organization_id: tenant.organizationId,
            name: input.name,
            category_id: input.categoryId,
            unit: input.unit,
            sale_price: input.salePrice,
            purchase_price: input.purchasePrice,
            tax_rate_id: input.taxRateId,
            barcode: input.barcode,
            kind: input.kind,
            track_stock: input.trackStock,
            low_stock_threshold: input.lowStockThreshold,
            client_operation_id: input.clientOperationId,
            created_by: user.userId,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        if (input.initialStock !== null) {
          await trx
            .insertInto('app.stock_movements')
            .values({
              organization_id: tenant.organizationId,
              product_id: id,
              kind: 'initial',
              quantity: input.initialStock,
              unit_cost: input.purchasePrice,
              client_operation_id: input.clientOperationId,
              created_by: user.userId,
            })
            .execute();
        }
        await this.audit.record(trx, {
          organizationId: tenant.organizationId,
          actorType: 'user',
          actorId: user.userId,
          action: 'product.created',
          targetType: 'product',
          targetId: id,
          metadata: {
            name: input.name,
            salePrice: input.salePrice,
            initialStock: input.initialStock,
          },
          requestId,
        });
        return {
          product: await this.find(trx, tenant.organizationId, id),
          replayed: false,
        };
      });
    } catch (error) {
      throw translateUnique(error);
    }
  }

  async update(
    tenant: TenantContext,
    user: AuthContext,
    id: string,
    input: UpdateProductInput,
    requestId: string | null,
  ): Promise<ProductDto> {
    try {
      return await this.database.db.transaction().execute(async (trx) => {
        const before = await this.lock(trx, tenant.organizationId, id);
        if (before.version !== input.version) {
          throw new ApiException(
            HttpStatus.CONFLICT,
            'VERSION_CONFLICT',
            'Ce produit a été modifié entre-temps. Rechargez la page pour voir la dernière version.',
          );
        }
        const unit = input.unit ?? before.unit;
        const threshold =
          input.lowStockThreshold === undefined
            ? before.lowStockThreshold
            : input.lowStockThreshold;
        this.assertQuantityFitsUnit('lowStockThreshold', threshold, unit);
        if (
          input.unit &&
          input.unit !== before.unit &&
          !quantityFitsUnit(before.stockQuantity, unit)
        )
          throw invalid(
            'unit',
            'Le stock actuel n’est pas un nombre entier : faites d’abord un inventaire.',
          );
        // Selling units count in the stock unit: « sac = 50 » means 50 kg.
        if (input.unit && input.unit !== before.unit && before.units.length > 0)
          throw invalid(
            'unit',
            'Retirez d’abord les autres unités de vente de ce produit : elles sont comptées dans l’unité actuelle.',
          );
        const service = (input.kind ?? before.kind) === 'service';
        if (service && input.trackStock)
          throw invalid('trackStock', 'Un service n’a pas de stock.');
        if (service && before.units.length > 0)
          throw invalid(
            'kind',
            'Retirez d’abord les autres unités de vente de ce produit : un service n’en a pas.',
          );
        await this.assertReferences(trx, tenant.organizationId, {
          categoryId: input.categoryId,
          taxRateId: input.taxRateId,
        });
        if (input.status !== 'archived')
          await this.assertBarcodeFree(
            trx,
            tenant.organizationId,
            input.barcode,
            { productId: id },
          );

        const { version: _version, ...fields } = input;
        const changes: Record<string, { from: unknown; to: unknown }> = {};
        const current: Record<string, unknown> = {
          name: before.name,
          categoryId: before.category?.id ?? null,
          unit: before.unit,
          salePrice: before.salePrice,
          purchasePrice: before.purchasePrice,
          taxRateId: before.taxRate?.id ?? null,
          barcode: before.barcode,
          kind: before.kind,
          trackStock: before.trackStock,
          lowStockThreshold: before.lowStockThreshold,
          status: before.status,
        };
        for (const [key, to] of Object.entries(fields)) {
          if (to !== undefined && to !== current[key])
            changes[key] = { from: current[key], to };
        }
        if (Object.keys(changes).length === 0) return before;

        await trx
          .updateTable('app.products')
          .set({
            name: input.name,
            category_id: input.categoryId,
            unit: input.unit,
            sale_price: input.salePrice,
            purchase_price: input.purchasePrice,
            tax_rate_id: input.taxRateId,
            barcode: input.barcode,
            kind: input.kind,
            // Becoming a service ends the count of its stock.
            track_stock: service ? false : input.trackStock,
            low_stock_threshold: service ? null : input.lowStockThreshold,
            status: input.status,
            version: sql`version + 1`,
          })
          .where('organization_id', '=', tenant.organizationId)
          .where('id', '=', id)
          .execute();
        await this.audit.record(trx, {
          organizationId: tenant.organizationId,
          actorType: 'user',
          actorId: user.userId,
          action:
            changes.status?.to === 'archived'
              ? 'product.archived'
              : 'product.updated',
          targetType: 'product',
          targetId: id,
          metadata: { changes },
          requestId,
        });
        return this.find(trx, tenant.organizationId, id);
      });
    } catch (error) {
      throw translateUnique(error);
    }
  }

  // -------------------------------------------------------------------------
  // Selling units (ADR-038)
  // -------------------------------------------------------------------------

  async createUnit(
    tenant: TenantContext,
    user: AuthContext,
    productId: string,
    input: CreateProductUnitInput,
    requestId: string | null,
  ): Promise<{ product: ProductDto; replayed: boolean }> {
    try {
      return await this.database.db.transaction().execute(async (trx) => {
        const product = await this.lock(trx, tenant.organizationId, productId);
        if (product.kind === 'service')
          throw invalid(
            'label',
            'Un service n’a pas d’unité de vente : il se vend dans son unité.',
          );
        const existing = await trx
          .selectFrom('app.product_units')
          .select('product_id')
          .where('organization_id', '=', tenant.organizationId)
          .where('client_operation_id', '=', input.clientOperationId)
          .executeTakeFirst();
        if (existing)
          return {
            product: await this.find(
              trx,
              tenant.organizationId,
              existing.product_id,
            ),
            replayed: true,
          };
        if (product.status !== 'active')
          throw conflict('PRODUCT_ARCHIVED', 'Ce produit est archivé.');
        if (!quantityFitsUnit(input.factor, product.unit))
          throw invalid(
            'factor',
            'Nombre entier attendu : ce produit est compté à l’unité.',
          );
        const { max_product_units } = await trx
          .selectFrom('app.organizations')
          .select('max_product_units')
          .where('id', '=', tenant.organizationId)
          .executeTakeFirstOrThrow();
        if (product.units.length >= max_product_units)
          throw limitReached('unités de vente par produit', max_product_units);
        await this.assertBarcodeFree(
          trx,
          tenant.organizationId,
          input.barcode,
          {},
        );

        const { id } = await trx
          .insertInto('app.product_units')
          .values({
            organization_id: tenant.organizationId,
            product_id: productId,
            label: input.label,
            factor: input.factor,
            sale_price: input.salePrice,
            allows_decimals: input.allowsDecimals,
            barcode: input.barcode,
            client_operation_id: input.clientOperationId,
            created_by: user.userId,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        await this.audit.record(trx, {
          organizationId: tenant.organizationId,
          actorType: 'user',
          actorId: user.userId,
          action: 'product.unit_added',
          targetType: 'product',
          targetId: productId,
          metadata: {
            unitId: id,
            label: input.label,
            factor: input.factor,
            salePrice: input.salePrice,
          },
          requestId,
        });
        return {
          product: await this.find(trx, tenant.organizationId, productId),
          replayed: false,
        };
      });
    } catch (error) {
      throw translateUnique(error);
    }
  }

  async updateUnit(
    tenant: TenantContext,
    user: AuthContext,
    productId: string,
    unitId: string,
    input: UpdateProductUnitInput,
    requestId: string | null,
  ): Promise<ProductDto> {
    if (!UUID_RE.test(unitId)) throw unitNotFound();
    try {
      return await this.database.db.transaction().execute(async (trx) => {
        await this.lock(trx, tenant.organizationId, productId);
        const before = await trx
          .selectFrom('app.product_units')
          .select([
            'id',
            'label',
            'factor',
            'sale_price',
            'allows_decimals',
            'barcode',
            'status',
            'version',
          ])
          .where('organization_id', '=', tenant.organizationId)
          .where('product_id', '=', productId)
          .where('id', '=', unitId)
          .executeTakeFirst();
        if (!before) throw unitNotFound();
        if (before.version !== input.version)
          throw new ApiException(
            HttpStatus.CONFLICT,
            'VERSION_CONFLICT',
            'Cette unité a été modifiée entre-temps. Rechargez la page pour voir la dernière version.',
          );
        const status = input.status ?? before.status;
        if (status === 'active') {
          await this.assertBarcodeFree(
            trx,
            tenant.organizationId,
            input.barcode === undefined ? before.barcode : input.barcode,
            { unitId },
          );
          if (before.status === 'archived') {
            const [{ count }, { max_product_units }] = await Promise.all([
              trx
                .selectFrom('app.product_units')
                .select((eb) => eb.fn.countAll<string>().as('count'))
                .where('organization_id', '=', tenant.organizationId)
                .where('product_id', '=', productId)
                .where('status', '=', 'active')
                .executeTakeFirstOrThrow(),
              trx
                .selectFrom('app.organizations')
                .select('max_product_units')
                .where('id', '=', tenant.organizationId)
                .executeTakeFirstOrThrow(),
            ]);
            if (Number(count) >= max_product_units)
              throw limitReached(
                'unités de vente par produit',
                max_product_units,
              );
          }
        }

        const { version: _version, ...fields } = input;
        const current: Record<string, unknown> = {
          label: before.label,
          salePrice: toNullableNumber(before.sale_price),
          allowsDecimals: before.allows_decimals,
          barcode: before.barcode,
          status: before.status,
        };
        const changes: Record<string, { from: unknown; to: unknown }> = {};
        for (const [key, to] of Object.entries(fields))
          if (to !== undefined && to !== current[key])
            changes[key] = { from: current[key], to };
        if (Object.keys(changes).length > 0) {
          await trx
            .updateTable('app.product_units')
            .set({
              label: input.label,
              sale_price: input.salePrice,
              allows_decimals: input.allowsDecimals,
              barcode: input.barcode,
              status: input.status,
              version: sql`version + 1`,
            })
            .where('organization_id', '=', tenant.organizationId)
            .where('id', '=', unitId)
            .execute();
          await this.audit.record(trx, {
            organizationId: tenant.organizationId,
            actorType: 'user',
            actorId: user.userId,
            action:
              changes.status?.to === 'archived'
                ? 'product.unit_archived'
                : 'product.unit_updated',
            targetType: 'product',
            targetId: productId,
            metadata: {
              unitId,
              label: before.label,
              factor: toNumber(before.factor),
              changes,
            },
            requestId,
          });
        }
        return this.find(trx, tenant.organizationId, productId);
      });
    } catch (error) {
      throw translateUnique(error);
    }
  }

  // -------------------------------------------------------------------------
  // Photo
  // -------------------------------------------------------------------------

  async photo(
    organizationId: string,
    id: string,
  ): Promise<{ contentType: ProductPhotoType; data: Buffer; sha256: string }> {
    if (!UUID_RE.test(id)) throw productNotFound();
    const row = await this.database.db
      .selectFrom('app.products as p')
      .leftJoin('app.product_photos as f', (join) =>
        join
          .onRef('f.organization_id', '=', 'p.organization_id')
          .onRef('f.product_id', '=', 'p.id')
          .onRef('f.sha256', '=', 'p.photo_sha256'),
      )
      .select(['f.content_type', 'f.data', 'f.sha256'])
      .where('p.organization_id', '=', organizationId)
      .where('p.id', '=', id)
      .executeTakeFirst();
    if (!row) throw productNotFound();
    if (!row.content_type || !row.data || !row.sha256)
      throw notFound('PHOTO_NOT_FOUND', 'Ce produit n’a pas de photo.');
    return {
      contentType: row.content_type,
      data: row.data,
      sha256: row.sha256,
    };
  }

  async setPhoto(
    tenant: TenantContext,
    user: AuthContext,
    id: string,
    declaredType: string | undefined,
    data: unknown,
    requestId: string | null,
  ): Promise<ProductDto> {
    if (!Buffer.isBuffer(data) || data.length === 0)
      throw invalid('photo', 'Envoyez une image WebP, JPEG ou PNG.');
    if (data.length > PRODUCT_PHOTO_MAX_BYTES)
      throw new ApiException(
        HttpStatus.PAYLOAD_TOO_LARGE,
        'PHOTO_TOO_LARGE',
        'Photo trop lourde : 512 Ko au plus.',
      );
    const contentType = detectImageType(data);
    if (!contentType || contentType !== declaredType?.split(';')[0]?.trim())
      throw invalid('photo', 'Envoyez une image WebP, JPEG ou PNG.');
    const sha256 = createHash('sha256').update(data).digest('hex');

    return this.database.db.transaction().execute(async (trx) => {
      await this.lock(trx, tenant.organizationId, id);
      await trx
        .insertInto('app.product_photos')
        .values({
          organization_id: tenant.organizationId,
          product_id: id,
          content_type: contentType,
          data,
          sha256,
          updated_by: user.userId,
        })
        .onConflict((oc) =>
          oc.columns(['organization_id', 'product_id']).doUpdateSet({
            content_type: contentType,
            data,
            sha256,
            updated_by: user.userId,
            updated_at: new Date(),
          }),
        )
        .execute();
      await trx
        .updateTable('app.products')
        .set({ photo_sha256: sha256 })
        .where('organization_id', '=', tenant.organizationId)
        .where('id', '=', id)
        .execute();
      await this.audit.record(trx, {
        organizationId: tenant.organizationId,
        actorType: 'user',
        actorId: user.userId,
        action: 'product.photo_changed',
        targetType: 'product',
        targetId: id,
        metadata: { contentType, bytes: data.length },
        requestId,
      });
      return this.find(trx, tenant.organizationId, id);
    });
  }

  /** Hides the photo; the bytes are overwritten by the next one. */
  async removePhoto(
    tenant: TenantContext,
    user: AuthContext,
    id: string,
    requestId: string | null,
  ): Promise<ProductDto> {
    return this.database.db.transaction().execute(async (trx) => {
      const product = await this.lock(trx, tenant.organizationId, id);
      if (!product.photoVersion) return product;
      await trx
        .updateTable('app.products')
        .set({ photo_sha256: null })
        .where('organization_id', '=', tenant.organizationId)
        .where('id', '=', id)
        .execute();
      await this.audit.record(trx, {
        organizationId: tenant.organizationId,
        actorType: 'user',
        actorId: user.userId,
        action: 'product.photo_removed',
        targetType: 'product',
        targetId: id,
        requestId,
      });
      return this.find(trx, tenant.organizationId, id);
    });
  }
}
