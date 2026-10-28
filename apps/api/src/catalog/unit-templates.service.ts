import { Injectable } from '@nestjs/common';
import type {
  CreateUnitTemplateInput,
  UnitTemplateDto,
  UpdateUnitTemplateInput,
} from '@nagaw/shared';
import { sql } from 'kysely';
import { AuditService } from '../audit/audit.service.js';
import type { ApiException } from '../common/api-exception.js';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { DatabaseService } from '../database/database.service.js';
import { pgErrorCode, UNIQUE_VIOLATION } from '../database/pg-errors.js';
import {
  conflict,
  limitReached,
  notFound,
  toNumber,
  UUID_RE,
  type Executor,
} from './catalog.errors.js';

function templateNotFound(): ApiException {
  return notFound('UNIT_TEMPLATE_NOT_FOUND', 'Modèle d’unité introuvable.');
}

function translateUnique(error: unknown): unknown {
  return pgErrorCode(error) === UNIQUE_VIOLATION
    ? conflict('NAME_TAKEN', 'Un modèle porte déjà ce nom pour cette unité.')
    : error;
}

/**
 * Units of the shop (« sac de 50 kg », « carton de 24 »), copied into a
 * product's selling units (ADR-038). A template is a starting point: a
 * product keeps its copy whatever happens to the template.
 */
@Injectable()
export class UnitTemplatesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  private select(executor: Executor, organizationId: string) {
    return executor
      .selectFrom('app.unit_templates')
      .select([
        'id',
        'label',
        'stock_unit',
        'factor',
        'allows_decimals',
        'status',
        'created_at',
      ])
      .where('organization_id', '=', organizationId);
  }

  private toDto(
    row: Awaited<
      ReturnType<ReturnType<UnitTemplatesService['select']>['execute']>
    >[number],
  ): UnitTemplateDto {
    return {
      id: row.id,
      label: row.label,
      stockUnit: row.stock_unit,
      factor: toNumber(row.factor),
      allowsDecimals: row.allows_decimals,
      status: row.status,
      createdAt: row.created_at.toISOString(),
    };
  }

  async list(organizationId: string): Promise<UnitTemplateDto[]> {
    const rows = await this.select(this.database.db, organizationId)
      .where('status', '=', 'active')
      .orderBy('stock_unit')
      .orderBy('factor')
      .orderBy(sql`lower(label)`)
      .execute();
    return rows.map((row) => this.toDto(row));
  }

  async create(
    tenant: TenantContext,
    user: AuthContext,
    input: CreateUnitTemplateInput,
    requestId: string | null,
  ): Promise<{ template: UnitTemplateDto; replayed: boolean }> {
    try {
      return await this.database.db.transaction().execute(async (trx) => {
        const org = await trx
          .selectFrom('app.organizations')
          .select('max_unit_templates')
          .where('id', '=', tenant.organizationId)
          .forUpdate()
          .executeTakeFirstOrThrow();
        const existing = await this.select(trx, tenant.organizationId)
          .where('client_operation_id', '=', input.clientOperationId)
          .executeTakeFirst();
        if (existing) return { template: this.toDto(existing), replayed: true };
        const { count } = await trx
          .selectFrom('app.unit_templates')
          .select((eb) => eb.fn.countAll<string>().as('count'))
          .where('organization_id', '=', tenant.organizationId)
          .where('status', '=', 'active')
          .executeTakeFirstOrThrow();
        if (Number(count) >= org.max_unit_templates)
          throw limitReached('modèles d’unités', org.max_unit_templates);
        const { id } = await trx
          .insertInto('app.unit_templates')
          .values({
            organization_id: tenant.organizationId,
            label: input.label,
            stock_unit: input.stockUnit,
            factor: input.factor,
            allows_decimals: input.allowsDecimals,
            client_operation_id: input.clientOperationId,
            created_by: user.userId,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        await this.audit.record(trx, {
          organizationId: tenant.organizationId,
          actorType: 'user',
          actorId: user.userId,
          action: 'unit_template.created',
          targetType: 'unit_template',
          targetId: id,
          metadata: {
            label: input.label,
            stockUnit: input.stockUnit,
            factor: input.factor,
          },
          requestId,
        });
        const created = await this.select(trx, tenant.organizationId)
          .where('id', '=', id)
          .executeTakeFirstOrThrow();
        return { template: this.toDto(created), replayed: false };
      });
    } catch (error) {
      throw translateUnique(error);
    }
  }

  async update(
    tenant: TenantContext,
    user: AuthContext,
    id: string,
    input: UpdateUnitTemplateInput,
    requestId: string | null,
  ): Promise<UnitTemplateDto> {
    if (!UUID_RE.test(id)) throw templateNotFound();
    try {
      return await this.database.db.transaction().execute(async (trx) => {
        const before = await this.select(trx, tenant.organizationId)
          .where('id', '=', id)
          .forUpdate()
          .executeTakeFirst();
        if (!before) throw templateNotFound();
        if (before.status === 'archived' && input.status === 'active') {
          const [{ count }, { max_unit_templates }] = await Promise.all([
            trx
              .selectFrom('app.unit_templates')
              .select((eb) => eb.fn.countAll<string>().as('count'))
              .where('organization_id', '=', tenant.organizationId)
              .where('status', '=', 'active')
              .executeTakeFirstOrThrow(),
            trx
              .selectFrom('app.organizations')
              .select('max_unit_templates')
              .where('id', '=', tenant.organizationId)
              .executeTakeFirstOrThrow(),
          ]);
          if (Number(count) >= max_unit_templates)
            throw limitReached('modèles d’unités', max_unit_templates);
        }
        await trx
          .updateTable('app.unit_templates')
          .set({
            label: input.label,
            allows_decimals: input.allowsDecimals,
            status: input.status,
          })
          .where('organization_id', '=', tenant.organizationId)
          .where('id', '=', id)
          .execute();
        await this.audit.record(trx, {
          organizationId: tenant.organizationId,
          actorType: 'user',
          actorId: user.userId,
          action:
            input.status === 'archived' && before.status !== 'archived'
              ? 'unit_template.archived'
              : 'unit_template.updated',
          targetType: 'unit_template',
          targetId: id,
          metadata: { label: before.label, changes: input },
          requestId,
        });
        const after = await this.select(trx, tenant.organizationId)
          .where('id', '=', id)
          .executeTakeFirstOrThrow();
        return this.toDto(after);
      });
    } catch (error) {
      throw translateUnique(error);
    }
  }
}
