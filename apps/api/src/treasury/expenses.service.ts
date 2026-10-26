import { createHash } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import type {
  CancelExpenseInput,
  CreateExpenseCategoryInput,
  CreateExpenseInput,
  ExpenseCategoryDto,
  ExpenseDto,
  PeriodQuery,
  UpdateExpenseCategoryInput,
} from '@nagaw/shared';
import { PRODUCT_PHOTO_MAX_BYTES, type ProductPhotoType } from '@nagaw/shared';
import { sql } from 'kysely';
import { AuditService } from '../audit/audit.service.js';
import { detectImageType } from '../catalog/products.service.js';
import { ApiException } from '../common/api-exception.js';
import {
  conflict,
  invalid,
  limitReached,
  nameTaken,
  notFound,
  toNumber,
  UUID_RE,
  type Executor,
} from '../catalog/catalog.errors.js';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { today } from '../common/today.js';
import { DatabaseService } from '../database/database.service.js';
import { pgErrorCode, UNIQUE_VIOLATION } from '../database/pg-errors.js';
import { takeSequenceNumber } from '../database/sequences.js';
import { AlertsService } from '../notifications/alerts.service.js';
import { addDays, TreasuryService } from './treasury.service.js';

const categoryNotFound = () =>
  notFound('EXPENSE_CATEGORY_NOT_FOUND', 'Catégorie de dépense introuvable.');
const expenseNotFound = () =>
  notFound('EXPENSE_NOT_FOUND', 'Dépense introuvable.');

/** Expenses and their categories (ADR-027). */
@Injectable()
export class ExpensesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
    private readonly treasury: TreasuryService,
    private readonly alerts: AlertsService,
  ) {}

  async listCategories(organizationId: string): Promise<ExpenseCategoryDto[]> {
    const rows = await this.database.db
      .selectFrom('app.expense_categories')
      .select(['id', 'name', 'account_code', 'status'])
      .where('organization_id', '=', organizationId)
      .orderBy('status')
      .orderBy('name')
      .execute();
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      accountCode: r.account_code,
      status: r.status,
    }));
  }

  async createCategory(
    tenant: TenantContext,
    user: AuthContext,
    input: CreateExpenseCategoryInput,
    requestId: string | null,
  ): Promise<ExpenseCategoryDto> {
    try {
      return await this.database.db.transaction().execute(async (trx) => {
        const { max_expense_categories } = await trx
          .selectFrom('app.organizations')
          .select('max_expense_categories')
          .where('id', '=', tenant.organizationId)
          .forUpdate()
          .executeTakeFirstOrThrow();
        const { count } = await trx
          .selectFrom('app.expense_categories')
          .select((eb) => eb.fn.countAll<string>().as('count'))
          .where('organization_id', '=', tenant.organizationId)
          .where('status', '=', 'active')
          .executeTakeFirstOrThrow();
        if (toNumber(count) >= max_expense_categories)
          throw limitReached('catégories de dépenses', max_expense_categories);
        const row = await trx
          .insertInto('app.expense_categories')
          .values({
            organization_id: tenant.organizationId,
            name: input.name,
            account_code: input.accountCode,
          })
          .returning(['id', 'name', 'account_code', 'status'])
          .executeTakeFirstOrThrow();
        await this.audit.record(trx, {
          organizationId: tenant.organizationId,
          actorType: 'user',
          actorId: user.userId,
          action: 'expense_category.created',
          targetType: 'expense_category',
          targetId: row.id,
          metadata: { name: row.name, accountCode: row.account_code },
          requestId,
        });
        return {
          id: row.id,
          name: row.name,
          accountCode: row.account_code,
          status: row.status,
        };
      });
    } catch (error) {
      if (pgErrorCode(error) === UNIQUE_VIOLATION)
        throw nameTaken('Une catégorie');
      throw error;
    }
  }

  async updateCategory(
    tenant: TenantContext,
    user: AuthContext,
    id: string,
    input: UpdateExpenseCategoryInput,
    requestId: string | null,
  ): Promise<ExpenseCategoryDto> {
    if (!UUID_RE.test(id)) throw categoryNotFound();
    try {
      return await this.database.db.transaction().execute(async (trx) => {
        const before = await trx
          .selectFrom('app.expense_categories')
          .select(['id', 'name', 'account_code', 'status'])
          .where('organization_id', '=', tenant.organizationId)
          .where('id', '=', id)
          .forUpdate()
          .executeTakeFirst();
        if (!before) throw categoryNotFound();
        const set: Record<string, string> = {};
        if (input.name !== undefined) set.name = input.name;
        if (input.accountCode !== undefined)
          set.account_code = input.accountCode;
        if (input.status !== undefined) set.status = input.status;
        const row =
          Object.keys(set).length === 0
            ? before
            : await trx
                .updateTable('app.expense_categories')
                .set(set)
                .where('organization_id', '=', tenant.organizationId)
                .where('id', '=', id)
                .returning(['id', 'name', 'account_code', 'status'])
                .executeTakeFirstOrThrow();
        await this.audit.record(trx, {
          organizationId: tenant.organizationId,
          actorType: 'user',
          actorId: user.userId,
          action: 'expense_category.updated',
          targetType: 'expense_category',
          targetId: id,
          metadata: { changes: set },
          requestId,
        });
        return {
          id: row.id,
          name: row.name,
          accountCode: row.account_code,
          status: row.status,
        };
      });
    } catch (error) {
      if (pgErrorCode(error) === UNIQUE_VIOLATION)
        throw nameTaken('Une catégorie');
      throw error;
    }
  }

  private async expenseDto(
    executor: Executor,
    organizationId: string,
    id: string,
  ): Promise<ExpenseDto> {
    const [row] = await this.select(executor, organizationId)
      .where('e.id', '=', id)
      .execute();
    if (!row) throw expenseNotFound();
    return toExpenseDto(row);
  }

  private select(executor: Executor, organizationId: string) {
    return executor
      .selectFrom('app.expenses as e')
      .innerJoin('app.expense_categories as c', (join) =>
        join
          .onRef('c.organization_id', '=', 'e.organization_id')
          .onRef('c.id', '=', 'e.category_id'),
      )
      .innerJoin('app.cash_accounts as a', (join) =>
        join
          .onRef('a.organization_id', '=', 'e.organization_id')
          .onRef('a.id', '=', 'e.cash_account_id'),
      )
      .innerJoin('app.user_profiles as u', 'u.id', 'e.created_by')
      .leftJoin('app.expense_receipts as r', (join) =>
        join
          .onRef('r.organization_id', '=', 'e.organization_id')
          .onRef('r.expense_id', '=', 'e.id'),
      )
      .select([
        'e.id',
        'e.category_id',
        'c.name as category_name',
        'c.account_code',
        'e.cash_account_id',
        'a.name as account_name',
        'e.number',
        'r.sha256 as receipt_sha256',
        'e.label',
        'e.amount',
        'e.status',
        'e.cancelled_at',
        'e.cancel_reason',
        'e.created_by',
        'u.email',
        'e.created_at',
      ])
      .select(sql<string>`e.occurred_on::text`.as('day'))
      .where('e.organization_id', '=', organizationId);
  }

  async list(tenant: TenantContext, query: PeriodQuery): Promise<ExpenseDto[]> {
    const timeZone = await this.treasury.timeZone(
      this.database.db,
      tenant.organizationId,
    );
    const to = query.to ?? today(timeZone);
    const from = query.from ?? addDays(to, -30);
    const rows = await this.select(this.database.db, tenant.organizationId)
      .where('e.occurred_on', '>=', from)
      .where('e.occurred_on', '<=', to)
      .orderBy('e.occurred_on', 'desc')
      .orderBy('e.created_at', 'desc')
      .limit(500)
      .execute();
    return rows.map(toExpenseDto);
  }

  async create(
    tenant: TenantContext,
    user: AuthContext,
    input: CreateExpenseInput,
    requestId: string | null,
  ): Promise<{ expense: ExpenseDto; replayed: boolean }> {
    const replay = async (executor: Executor) => {
      const previous = await executor
        .selectFrom('app.expenses')
        .select('id')
        .where('organization_id', '=', tenant.organizationId)
        .where('client_operation_id', '=', input.clientOperationId)
        .executeTakeFirst();
      return previous
        ? this.expenseDto(executor, tenant.organizationId, previous.id)
        : null;
    };
    try {
      return await this.database.db.transaction().execute(async (trx) => {
        const previous = await replay(trx);
        if (previous) return { expense: previous, replayed: true };
        const category = UUID_RE.test(input.categoryId)
          ? await trx
              .selectFrom('app.expense_categories')
              .select(['id', 'status'])
              .where('organization_id', '=', tenant.organizationId)
              .where('id', '=', input.categoryId)
              .executeTakeFirst()
          : undefined;
        if (!category || category.status !== 'active')
          throw invalid('categoryId', 'Catégorie inconnue.');
        const account = UUID_RE.test(input.cashAccountId)
          ? await trx
              .selectFrom('app.cash_accounts')
              .select(['id', 'name'])
              .where('organization_id', '=', tenant.organizationId)
              .where('id', '=', input.cashAccountId)
              .forUpdate()
              .executeTakeFirst()
          : undefined;
        if (!account) throw invalid('cashAccountId', 'Caisse inconnue.');
        await this.treasury.assertOpenDay(
          trx,
          tenant.organizationId,
          [account.id],
          input.occurredOn,
          'occurredOn',
        );
        // Voucher number of the year of the expense, without gap (ADR-028).
        const year = Number(input.occurredOn.slice(0, 4));
        const n = await takeSequenceNumber(
          trx,
          tenant.organizationId,
          'expense',
          year,
        );
        const number = `DEP-${year}-${String(n).padStart(4, '0')}`;
        const { id } = await trx
          .insertInto('app.expenses')
          .values({
            organization_id: tenant.organizationId,
            number,
            category_id: category.id,
            cash_account_id: account.id,
            label: input.label,
            amount: input.amount,
            occurred_on: input.occurredOn,
            client_operation_id: input.clientOperationId,
            created_by: user.userId,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        await this.audit.record(trx, {
          organizationId: tenant.organizationId,
          actorType: 'user',
          actorId: user.userId,
          action: 'expense.recorded',
          targetType: 'expense',
          targetId: id,
          metadata: {
            number,
            amount: input.amount,
            label: input.label,
            account: account.name,
          },
          requestId,
        });
        await this.alerts.expenseRecorded(trx, {
          organizationId: tenant.organizationId,
          label: input.label,
          amount: input.amount,
          userId: user.userId,
        });
        return {
          expense: await this.expenseDto(trx, tenant.organizationId, id),
          replayed: false,
        };
      });
    } catch (error) {
      if (pgErrorCode(error) === UNIQUE_VIOLATION) {
        const previous = await replay(this.database.db);
        if (previous) return { expense: previous, replayed: true };
      }
      throw error;
    }
  }

  async cancel(
    tenant: TenantContext,
    user: AuthContext,
    id: string,
    input: CancelExpenseInput,
    requestId: string | null,
  ): Promise<ExpenseDto> {
    if (!UUID_RE.test(id)) throw expenseNotFound();
    return this.database.db.transaction().execute(async (trx) => {
      const expense = await trx
        .selectFrom('app.expenses')
        .select(['id', 'status', 'cash_account_id', 'amount', 'label'])
        .select(sql<string>`occurred_on::text`.as('day'))
        .where('organization_id', '=', tenant.organizationId)
        .where('id', '=', id)
        .forUpdate()
        .executeTakeFirst();
      if (!expense) throw expenseNotFound();
      if (expense.status !== 'recorded')
        throw conflict(
          'EXPENSE_ALREADY_CANCELLED',
          'Cette dépense est déjà annulée.',
        );
      // A counted day stays as it was counted.
      const last = await this.treasury.lastClosingDay(
        trx,
        tenant.organizationId,
        expense.cash_account_id,
      );
      if (last && expense.day <= last)
        throw conflict(
          'DAY_ALREADY_CLOSED',
          'La caisse a été clôturée depuis cette dépense : elle ne s’annule plus.',
        );
      await trx
        .updateTable('app.expenses')
        .set({
          status: 'cancelled',
          cancelled_at: new Date(),
          cancelled_by: user.userId,
          cancel_reason: input.reason,
        })
        .where('organization_id', '=', tenant.organizationId)
        .where('id', '=', id)
        .execute();
      await this.audit.record(trx, {
        organizationId: tenant.organizationId,
        actorType: 'user',
        actorId: user.userId,
        action: 'expense.cancelled',
        targetType: 'expense',
        targetId: id,
        metadata: {
          amount: toNumber(expense.amount),
          label: expense.label,
          reason: input.reason,
        },
        requestId,
      });
      return this.expenseDto(trx, tenant.organizationId, id);
    });
  }

  /** Receipt photo of an expense: same formats and limit as products. */
  async setReceipt(
    tenant: TenantContext,
    user: AuthContext,
    id: string,
    declaredType: string | undefined,
    data: unknown,
    requestId: string | null,
  ): Promise<ExpenseDto> {
    if (!UUID_RE.test(id)) throw expenseNotFound();
    if (!Buffer.isBuffer(data) || data.length === 0)
      throw invalid('receipt', 'Envoyez une photo WebP, JPEG ou PNG.');
    if (data.length > PRODUCT_PHOTO_MAX_BYTES)
      throw new ApiException(
        HttpStatus.PAYLOAD_TOO_LARGE,
        'PHOTO_TOO_LARGE',
        'Photo trop lourde : 512 Ko au plus.',
      );
    const contentType = detectImageType(data);
    if (!contentType || contentType !== declaredType?.split(';')[0]?.trim())
      throw invalid('receipt', 'Envoyez une photo WebP, JPEG ou PNG.');
    const sha256 = createHash('sha256').update(data).digest('hex');
    return this.database.db.transaction().execute(async (trx) => {
      const expense = await trx
        .selectFrom('app.expenses')
        .select(['id', 'number'])
        .where('organization_id', '=', tenant.organizationId)
        .where('id', '=', id)
        .forUpdate()
        .executeTakeFirst();
      if (!expense) throw expenseNotFound();
      await trx
        .insertInto('app.expense_receipts')
        .values({
          organization_id: tenant.organizationId,
          expense_id: id,
          content_type: contentType,
          data,
          sha256,
          updated_by: user.userId,
        })
        .onConflict((oc) =>
          oc.columns(['organization_id', 'expense_id']).doUpdateSet({
            content_type: contentType,
            data,
            sha256,
            updated_by: user.userId,
            updated_at: new Date(),
          }),
        )
        .execute();
      await this.audit.record(trx, {
        organizationId: tenant.organizationId,
        actorType: 'user',
        actorId: user.userId,
        action: 'expense.receipt_attached',
        targetType: 'expense',
        targetId: id,
        metadata: { number: expense.number, contentType, bytes: data.length },
        requestId,
      });
      return this.expenseDto(trx, tenant.organizationId, id);
    });
  }

  async receipt(
    organizationId: string,
    id: string,
  ): Promise<{ contentType: ProductPhotoType; data: Buffer; sha256: string }> {
    const row = UUID_RE.test(id)
      ? await this.database.db
          .selectFrom('app.expense_receipts')
          .select(['content_type', 'data', 'sha256'])
          .where('organization_id', '=', organizationId)
          .where('expense_id', '=', id)
          .executeTakeFirst()
      : undefined;
    if (!row)
      throw notFound(
        'RECEIPT_NOT_FOUND',
        'Cette dépense n’a pas de justificatif.',
      );
    return {
      contentType: row.content_type,
      data: row.data,
      sha256: row.sha256,
    };
  }
}

function toExpenseDto(row: {
  number: string;
  receipt_sha256: string | null;
  id: string;
  category_id: string;
  category_name: string;
  account_code: string;
  cash_account_id: string;
  account_name: string;
  label: string;
  amount: string;
  status: 'recorded' | 'cancelled';
  cancelled_at: Date | null;
  cancel_reason: string | null;
  created_by: string;
  email: string;
  created_at: Date;
  day: string;
}): ExpenseDto {
  return {
    id: row.id,
    number: row.number,
    receiptVersion: row.receipt_sha256?.slice(0, 16) ?? null,
    category: {
      id: row.category_id,
      name: row.category_name,
      accountCode: row.account_code,
    },
    account: { id: row.cash_account_id, name: row.account_name },
    label: row.label,
    amount: toNumber(row.amount),
    occurredOn: row.day,
    status: row.status,
    cancellation:
      row.cancelled_at && row.cancel_reason
        ? { at: row.cancelled_at.toISOString(), reason: row.cancel_reason }
        : null,
    createdBy: { userId: row.created_by, email: row.email },
    createdAt: row.created_at.toISOString(),
  };
}
