import { HttpStatus, Injectable } from '@nestjs/common';
import type {
  CreateCustomerInput,
  CustomerActivityDto,
  CustomerDetailDto,
  CustomerDto,
  CustomerRepaymentInput,
  UpdateCustomerInput,
} from '@nagaw/shared';
import { sql, type Transaction } from 'kysely';
import { AuditService } from '../audit/audit.service.js';
import { ApiException } from '../common/api-exception.js';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { DatabaseService } from '../database/database.service.js';
import { pgErrorCode, UNIQUE_VIOLATION } from '../database/pg-errors.js';
import type { Database } from '../database/schema.js';
import {
  conflict,
  limitReached,
  notFound,
  toNullableNumber,
  toNumber,
  UUID_RE,
  type Executor,
} from '../catalog/catalog.errors.js';

export function customerNotFound(): ApiException {
  return notFound('CUSTOMER_NOT_FOUND', 'Client introuvable.');
}

/**
 * What each customer of a shop owes: credit of its completed sales minus
 * what it paid back. Computed, never stored (ADR-024).
 */
export function balances(executor: Executor, organizationId: string) {
  return executor
    .selectFrom('app.customers as c')
    .select('c.id as customer_id')
    .select(
      sql<string>`
        coalesce((
          select sum(p.amount) from app.sale_payments p
          join app.sales s on s.organization_id = p.organization_id and s.id = p.sale_id
          where s.organization_id = c.organization_id and s.customer_id = c.id
            and s.status = 'completed' and p.method = 'credit'
        ), 0)
        - coalesce((
          select sum(r.amount) from app.customer_payments r
          where r.organization_id = c.organization_id and r.customer_id = c.id
        ), 0)`.as('balance'),
    )
    .where('c.organization_id', '=', organizationId);
}

@Injectable()
export class CustomersService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  private select(executor: Executor, organizationId: string) {
    return executor
      .selectFrom('app.customers as c')
      .innerJoin(
        balances(executor, organizationId).as('b'),
        'b.customer_id',
        'c.id',
      )
      .select([
        'c.id',
        'c.name',
        'c.phone',
        'c.notes',
        'c.credit_limit',
        'c.status',
        'c.created_at',
        'c.updated_at',
        'b.balance',
      ])
      .where('c.organization_id', '=', organizationId);
  }

  private toDto(
    row: Awaited<
      ReturnType<ReturnType<CustomersService['select']>['execute']>
    >[number],
  ): CustomerDto {
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      notes: row.notes,
      creditLimit: toNullableNumber(row.credit_limit),
      balance: toNumber(row.balance),
      status: row.status,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  async list(
    organizationId: string,
    query: { q?: string; owing?: boolean },
  ): Promise<CustomerDto[]> {
    let q = this.select(this.database.db, organizationId)
      .where('c.status', '=', 'active')
      .orderBy(sql`lower(c.name)`)
      .limit(500);
    if (query.q) {
      const text = `%${query.q.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      q = q.where((eb) =>
        eb.or([
          eb(sql`lower(c.name)`, 'like', text),
          eb(sql`replace(c.phone, ' ', '')`, 'like', text.replace(/\s/g, '')),
        ]),
      );
    }
    if (query.owing) q = q.where(sql<string>`b.balance`, '>', '0');
    return (await q.execute()).map((row) => this.toDto(row));
  }

  async find(
    executor: Executor,
    organizationId: string,
    id: string,
  ): Promise<CustomerDto> {
    if (!UUID_RE.test(id)) throw customerNotFound();
    const row = await this.select(executor, organizationId)
      .where('c.id', '=', id)
      .executeTakeFirst();
    if (!row) throw customerNotFound();
    return this.toDto(row);
  }

  async get(organizationId: string, id: string): Promise<CustomerDetailDto> {
    const customer = await this.find(this.database.db, organizationId, id);
    const [credit, repayments] = await Promise.all([
      this.database.db
        .selectFrom('app.sale_payments as p')
        .innerJoin('app.sales as s', (join) =>
          join
            .onRef('s.organization_id', '=', 'p.organization_id')
            .onRef('s.id', '=', 'p.sale_id'),
        )
        .select(['s.id', 's.sale_number', 'p.amount', 's.occurred_at'])
        .where('s.organization_id', '=', organizationId)
        .where('s.customer_id', '=', id)
        .where('s.status', '=', 'completed')
        .where('p.method', '=', 'credit')
        .orderBy('s.occurred_at', 'desc')
        .limit(50)
        .execute(),
      this.database.db
        .selectFrom('app.customer_payments')
        .select(['id', 'amount', 'method', 'created_at'])
        .where('organization_id', '=', organizationId)
        .where('customer_id', '=', id)
        .orderBy('created_at', 'desc')
        .limit(50)
        .execute(),
    ]);
    const activity: CustomerActivityDto[] = [
      ...credit.map((row) => ({
        kind: 'credit_sale' as const,
        id: row.id,
        saleNumber: row.sale_number,
        amount: toNumber(row.amount),
        method: 'credit' as const,
        at: row.occurred_at.toISOString(),
      })),
      ...repayments.map((row) => ({
        kind: 'repayment' as const,
        id: row.id,
        saleNumber: null,
        amount: toNumber(row.amount),
        method: row.method,
        at: row.created_at.toISOString(),
      })),
    ].sort((a, b) => b.at.localeCompare(a.at));
    return { ...customer, activity };
  }

  /** Inside the caller's transaction (also used at checkout). */
  async create(
    trx: Transaction<Database>,
    tenant: TenantContext,
    user: AuthContext,
    input: CreateCustomerInput,
    requestId: string | null,
  ): Promise<{ customer: CustomerDto; replayed: boolean }> {
    const existing = await trx
      .selectFrom('app.customers')
      .select('id')
      .where('organization_id', '=', tenant.organizationId)
      .where('client_operation_id', '=', input.clientOperationId)
      .executeTakeFirst();
    if (existing)
      return {
        customer: await this.find(trx, tenant.organizationId, existing.id),
        replayed: true,
      };
    const org = await trx
      .selectFrom('app.organizations')
      .select('max_customers')
      .where('id', '=', tenant.organizationId)
      .forUpdate()
      .executeTakeFirstOrThrow();
    const { count } = await trx
      .selectFrom('app.customers')
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .where('organization_id', '=', tenant.organizationId)
      .where('status', '=', 'active')
      .executeTakeFirstOrThrow();
    if (Number(count) >= org.max_customers)
      throw limitReached('clients', org.max_customers);
    const { id } = await trx
      .insertInto('app.customers')
      .values({
        organization_id: tenant.organizationId,
        name: input.name,
        phone: input.phone,
        notes: input.notes,
        credit_limit: input.creditLimit,
        client_operation_id: input.clientOperationId,
        created_by: user.userId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await this.audit.record(trx, {
      organizationId: tenant.organizationId,
      actorType: 'user',
      actorId: user.userId,
      action: 'customer.created',
      targetType: 'customer',
      targetId: id,
      metadata: { name: input.name },
      requestId,
    });
    return {
      customer: await this.find(trx, tenant.organizationId, id),
      replayed: false,
    };
  }

  createAlone(
    tenant: TenantContext,
    user: AuthContext,
    input: CreateCustomerInput,
    requestId: string | null,
  ) {
    return this.database.db
      .transaction()
      .execute((trx) => this.create(trx, tenant, user, input, requestId));
  }

  async update(
    tenant: TenantContext,
    user: AuthContext,
    id: string,
    input: UpdateCustomerInput,
    requestId: string | null,
  ): Promise<CustomerDto> {
    return this.database.db.transaction().execute(async (trx) => {
      const before = await this.find(trx, tenant.organizationId, id);
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      for (const [key, to] of Object.entries(input)) {
        const from = before[key as keyof CustomerDto];
        if (to !== undefined && to !== from) changes[key] = { from, to };
      }
      if (Object.keys(changes).length === 0) return before;
      await trx
        .updateTable('app.customers')
        .set({
          name: input.name,
          phone: input.phone,
          notes: input.notes,
          credit_limit: input.creditLimit,
          status: input.status,
        })
        .where('organization_id', '=', tenant.organizationId)
        .where('id', '=', id)
        .execute();
      await this.audit.record(trx, {
        organizationId: tenant.organizationId,
        actorType: 'user',
        actorId: user.userId,
        action: 'customer.updated',
        targetType: 'customer',
        targetId: id,
        metadata: { changes },
        requestId,
      });
      return this.find(trx, tenant.organizationId, id);
    });
  }

  /** The customer pays back part or all of what they owe. */
  async repay(
    tenant: TenantContext,
    user: AuthContext,
    id: string,
    input: CustomerRepaymentInput,
    requestId: string | null,
  ): Promise<{ customer: CustomerDto; replayed: boolean }> {
    if (!UUID_RE.test(id)) throw customerNotFound();
    try {
      return await this.database.db.transaction().execute(async (trx) => {
        // Locks the customer: two repayments never both pass the check.
        const locked = await trx
          .selectFrom('app.customers')
          .select('id')
          .where('organization_id', '=', tenant.organizationId)
          .where('id', '=', id)
          .forUpdate()
          .executeTakeFirst();
        if (!locked) throw customerNotFound();
        const previous = await trx
          .selectFrom('app.customer_payments')
          .select('customer_id')
          .where('organization_id', '=', tenant.organizationId)
          .where('client_operation_id', '=', input.clientOperationId)
          .executeTakeFirst();
        if (previous) {
          if (previous.customer_id !== id)
            throw conflict(
              'OPERATION_ID_REUSED',
              'Cet identifiant d’opération a déjà servi pour un autre client.',
            );
          return {
            customer: await this.find(trx, tenant.organizationId, id),
            replayed: true,
          };
        }
        const customer = await this.find(trx, tenant.organizationId, id);
        if (input.amount > customer.balance)
          throw new ApiException(
            HttpStatus.CONFLICT,
            'REPAYMENT_TOO_HIGH',
            customer.balance > 0
              ? 'Ce montant dépasse ce que le client doit.'
              : 'Ce client ne doit rien.',
          );
        await trx
          .insertInto('app.customer_payments')
          .values({
            organization_id: tenant.organizationId,
            customer_id: id,
            method: input.method,
            provider: input.provider,
            reference: input.reference,
            amount: input.amount,
            client_operation_id: input.clientOperationId,
            created_by: user.userId,
          })
          .execute();
        await this.audit.record(trx, {
          organizationId: tenant.organizationId,
          actorType: 'user',
          actorId: user.userId,
          action: 'customer.repaid',
          targetType: 'customer',
          targetId: id,
          metadata: {
            amount: input.amount,
            method: input.method,
            balanceBefore: customer.balance,
          },
          requestId,
        });
        return {
          customer: await this.find(trx, tenant.organizationId, id),
          replayed: false,
        };
      });
    } catch (error) {
      if (pgErrorCode(error) === UNIQUE_VIOLATION)
        return {
          customer: await this.find(
            this.database.db,
            tenant.organizationId,
            id,
          ),
          replayed: true,
        };
      throw error;
    }
  }
}
