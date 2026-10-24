import { Injectable } from '@nestjs/common';
import type {
  CategoryDto,
  CreateCategoryInput,
  CreateSupplierInput,
  CreateTaxRateInput,
  SupplierDto,
  TaxRateDto,
  UpdateCategoryInput,
  UpdateSupplierInput,
  UpdateTaxRateInput,
} from '@nagaw/shared';
import { AuditService } from '../audit/audit.service.js';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { DatabaseService } from '../database/database.service.js';
import { pgErrorCode, UNIQUE_VIOLATION } from '../database/pg-errors.js';
import {
  limitReached,
  lockOrganization,
  nameTaken,
  notFound,
  UUID_RE,
} from './catalog.errors.js';

/** Fields that differ between two versions, for the audit trail. */
function changedFields<T extends object>(
  before: T,
  after: Partial<T>,
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const [key, to] of Object.entries(after)) {
    const from = before[key as keyof T];
    if (to !== undefined && to !== from) changes[key] = { from, to };
  }
  return changes;
}

/** A unique index on the active name was hit: same name already in use. */
async function uniqueName<T>(what: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (pgErrorCode(error) === UNIQUE_VIOLATION) throw nameTaken(what);
    throw error;
  }
}

/**
 * Tax rates, categories and suppliers of a shop: small reference lists,
 * archived rather than deleted, capped per organization (ADR-023).
 */
@Injectable()
export class ReferencesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  // -------------------------------------------------------------------------
  // Tax rates
  // -------------------------------------------------------------------------

  async listTaxRates(organizationId: string): Promise<TaxRateDto[]> {
    const rows = await this.database.db
      .selectFrom('app.tax_rates')
      .selectAll()
      .where('organization_id', '=', organizationId)
      .orderBy('status')
      .orderBy('rate_basis_points')
      .execute();
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      rateBasisPoints: row.rate_basis_points,
      status: row.status,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    }));
  }

  private async taxRate(
    organizationId: string,
    id: string,
  ): Promise<TaxRateDto> {
    const found = UUID_RE.test(id)
      ? (await this.listTaxRates(organizationId)).find((t) => t.id === id)
      : undefined;
    if (!found) throw notFound('TAX_RATE_NOT_FOUND', 'Taxe introuvable.');
    return found;
  }

  createTaxRate(
    tenant: TenantContext,
    user: AuthContext,
    input: CreateTaxRateInput,
    requestId: string | null,
  ): Promise<TaxRateDto> {
    return uniqueName('Une taxe', async () => {
      const id = await this.database.db.transaction().execute(async (trx) => {
        const org = await lockOrganization(trx, tenant.organizationId);
        const { count } = await trx
          .selectFrom('app.tax_rates')
          .select((eb) => eb.fn.countAll<string>().as('count'))
          .where('organization_id', '=', tenant.organizationId)
          .where('status', '=', 'active')
          .executeTakeFirstOrThrow();
        if (Number(count) >= org.max_tax_rates)
          throw limitReached('taxes', org.max_tax_rates);
        const { id } = await trx
          .insertInto('app.tax_rates')
          .values({
            organization_id: tenant.organizationId,
            name: input.name,
            rate_basis_points: input.rateBasisPoints,
            created_by: user.userId,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        await this.audit.record(trx, {
          organizationId: tenant.organizationId,
          actorType: 'user',
          actorId: user.userId,
          action: 'tax_rate.created',
          targetType: 'tax_rate',
          targetId: id,
          metadata: { ...input },
          requestId,
        });
        return id;
      });
      return this.taxRate(tenant.organizationId, id);
    });
  }

  updateTaxRate(
    tenant: TenantContext,
    user: AuthContext,
    id: string,
    input: UpdateTaxRateInput,
    requestId: string | null,
  ): Promise<TaxRateDto> {
    return uniqueName('Une taxe', async () => {
      const before = await this.taxRate(tenant.organizationId, id);
      const changes = changedFields(before, input);
      if (Object.keys(changes).length > 0) {
        await this.database.db.transaction().execute(async (trx) => {
          await trx
            .updateTable('app.tax_rates')
            .set({
              name: input.name,
              rate_basis_points: input.rateBasisPoints,
              status: input.status,
            })
            .where('organization_id', '=', tenant.organizationId)
            .where('id', '=', id)
            .execute();
          await this.audit.record(trx, {
            organizationId: tenant.organizationId,
            actorType: 'user',
            actorId: user.userId,
            action: 'tax_rate.updated',
            targetType: 'tax_rate',
            targetId: id,
            metadata: { changes },
            requestId,
          });
        });
      }
      return this.taxRate(tenant.organizationId, id);
    });
  }

  // -------------------------------------------------------------------------
  // Categories
  // -------------------------------------------------------------------------

  async listCategories(organizationId: string): Promise<CategoryDto[]> {
    const rows = await this.database.db
      .selectFrom('app.product_categories as c')
      .leftJoin('app.products as p', (join) =>
        join
          .onRef('p.organization_id', '=', 'c.organization_id')
          .onRef('p.category_id', '=', 'c.id')
          .on('p.status', '=', 'active'),
      )
      .select([
        'c.id',
        'c.name',
        'c.color',
        'c.status',
        'c.created_at',
        'c.updated_at',
      ])
      .select((eb) => eb.fn.count<string>('p.id').as('product_count'))
      .where('c.organization_id', '=', organizationId)
      .groupBy('c.id')
      .orderBy('c.status')
      .orderBy((eb) => eb.fn('lower', ['c.name']))
      .execute();
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      color: row.color,
      status: row.status,
      productCount: Number(row.product_count),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    }));
  }

  private async category(
    organizationId: string,
    id: string,
  ): Promise<CategoryDto> {
    const found = UUID_RE.test(id)
      ? (await this.listCategories(organizationId)).find((c) => c.id === id)
      : undefined;
    if (!found) throw notFound('CATEGORY_NOT_FOUND', 'Catégorie introuvable.');
    return found;
  }

  createCategory(
    tenant: TenantContext,
    user: AuthContext,
    input: CreateCategoryInput,
    requestId: string | null,
  ): Promise<CategoryDto> {
    return uniqueName('Une catégorie', async () => {
      const id = await this.database.db.transaction().execute(async (trx) => {
        const org = await lockOrganization(trx, tenant.organizationId);
        const { count } = await trx
          .selectFrom('app.product_categories')
          .select((eb) => eb.fn.countAll<string>().as('count'))
          .where('organization_id', '=', tenant.organizationId)
          .where('status', '=', 'active')
          .executeTakeFirstOrThrow();
        if (Number(count) >= org.max_product_categories)
          throw limitReached('catégories', org.max_product_categories);
        const { id } = await trx
          .insertInto('app.product_categories')
          .values({
            organization_id: tenant.organizationId,
            name: input.name,
            color: input.color,
            created_by: user.userId,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        await this.audit.record(trx, {
          organizationId: tenant.organizationId,
          actorType: 'user',
          actorId: user.userId,
          action: 'category.created',
          targetType: 'category',
          targetId: id,
          metadata: { ...input },
          requestId,
        });
        return id;
      });
      return this.category(tenant.organizationId, id);
    });
  }

  updateCategory(
    tenant: TenantContext,
    user: AuthContext,
    id: string,
    input: UpdateCategoryInput,
    requestId: string | null,
  ): Promise<CategoryDto> {
    return uniqueName('Une catégorie', async () => {
      const before = await this.category(tenant.organizationId, id);
      const changes = changedFields(before, input);
      if (Object.keys(changes).length > 0) {
        await this.database.db.transaction().execute(async (trx) => {
          await trx
            .updateTable('app.product_categories')
            .set({ name: input.name, color: input.color, status: input.status })
            .where('organization_id', '=', tenant.organizationId)
            .where('id', '=', id)
            .execute();
          await this.audit.record(trx, {
            organizationId: tenant.organizationId,
            actorType: 'user',
            actorId: user.userId,
            action: 'category.updated',
            targetType: 'category',
            targetId: id,
            metadata: { changes },
            requestId,
          });
        });
      }
      return this.category(tenant.organizationId, id);
    });
  }

  // -------------------------------------------------------------------------
  // Suppliers
  // -------------------------------------------------------------------------

  async listSuppliers(organizationId: string): Promise<SupplierDto[]> {
    const rows = await this.database.db
      .selectFrom('app.suppliers')
      .selectAll()
      .where('organization_id', '=', organizationId)
      .orderBy('status')
      .orderBy((eb) => eb.fn('lower', ['name']))
      .execute();
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      notes: row.notes,
      status: row.status,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    }));
  }

  private async supplier(
    organizationId: string,
    id: string,
  ): Promise<SupplierDto> {
    const found = UUID_RE.test(id)
      ? (await this.listSuppliers(organizationId)).find((s) => s.id === id)
      : undefined;
    if (!found)
      throw notFound('SUPPLIER_NOT_FOUND', 'Fournisseur introuvable.');
    return found;
  }

  createSupplier(
    tenant: TenantContext,
    user: AuthContext,
    input: CreateSupplierInput,
    requestId: string | null,
  ): Promise<SupplierDto> {
    return uniqueName('Un fournisseur', async () => {
      const id = await this.database.db.transaction().execute(async (trx) => {
        const org = await lockOrganization(trx, tenant.organizationId);
        const { count } = await trx
          .selectFrom('app.suppliers')
          .select((eb) => eb.fn.countAll<string>().as('count'))
          .where('organization_id', '=', tenant.organizationId)
          .where('status', '=', 'active')
          .executeTakeFirstOrThrow();
        if (Number(count) >= org.max_suppliers)
          throw limitReached('fournisseurs', org.max_suppliers);
        const { id } = await trx
          .insertInto('app.suppliers')
          .values({
            organization_id: tenant.organizationId,
            name: input.name,
            phone: input.phone,
            notes: input.notes,
            created_by: user.userId,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        await this.audit.record(trx, {
          organizationId: tenant.organizationId,
          actorType: 'user',
          actorId: user.userId,
          action: 'supplier.created',
          targetType: 'supplier',
          targetId: id,
          metadata: { name: input.name },
          requestId,
        });
        return id;
      });
      return this.supplier(tenant.organizationId, id);
    });
  }

  updateSupplier(
    tenant: TenantContext,
    user: AuthContext,
    id: string,
    input: UpdateSupplierInput,
    requestId: string | null,
  ): Promise<SupplierDto> {
    return uniqueName('Un fournisseur', async () => {
      const before = await this.supplier(tenant.organizationId, id);
      const changes = changedFields(before, input);
      if (Object.keys(changes).length > 0) {
        await this.database.db.transaction().execute(async (trx) => {
          await trx
            .updateTable('app.suppliers')
            .set({
              name: input.name,
              phone: input.phone,
              notes: input.notes,
              status: input.status,
            })
            .where('organization_id', '=', tenant.organizationId)
            .where('id', '=', id)
            .execute();
          await this.audit.record(trx, {
            organizationId: tenant.organizationId,
            actorType: 'user',
            actorId: user.userId,
            action: 'supplier.updated',
            targetType: 'supplier',
            targetId: id,
            metadata: { changes },
            requestId,
          });
        });
      }
      return this.supplier(tenant.organizationId, id);
    });
  }
}
