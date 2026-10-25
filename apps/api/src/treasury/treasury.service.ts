import { Injectable } from '@nestjs/common';
import type {
  CashAccountDto,
  CashMovementDto,
  CashMovementKind,
  CashMovementsDto,
  ClosingDto,
  CreateClosingInput,
  CreateTransferInput,
  ExpectedClosingDto,
  MovementsQuery,
  TreasuryDto,
  UpdateCashAccountInput,
} from '@nagaw/shared';
import { sql, type Transaction } from 'kysely';
import { AuditService } from '../audit/audit.service.js';
import {
  conflict,
  invalid,
  notFound,
  toNumber,
  UUID_RE,
  type Executor,
} from '../catalog/catalog.errors.js';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { today } from '../common/today.js';
import { DatabaseService } from '../database/database.service.js';
import { pgErrorCode, UNIQUE_VIOLATION } from '../database/pg-errors.js';
import type { Database } from '../database/schema.js';
import { movementsCte } from './movements.js';

const accountNotFound = () =>
  notFound('CASH_ACCOUNT_NOT_FOUND', 'Caisse introuvable.');

export function addDays(day: string, n: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

interface AccountRow {
  id: string;
  kind: CashAccountDto['kind'];
  provider: CashAccountDto['provider'];
  name: string;
  opening_balance: string;
}

/** Cash accounts, their balances, transfers and cash counts (ADR-027). */
@Injectable()
export class TreasuryService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  async timeZone(executor: Executor, organizationId: string): Promise<string> {
    const { timezone } = await executor
      .selectFrom('app.organizations')
      .select('timezone')
      .where('id', '=', organizationId)
      .executeTakeFirstOrThrow();
    return timezone;
  }

  private async accounts(executor: Executor, organizationId: string) {
    return executor
      .selectFrom('app.cash_accounts')
      .select(['id', 'kind', 'provider', 'name', 'opening_balance'])
      .where('organization_id', '=', organizationId)
      .orderBy(
        sql`case kind when 'cash' then 0 when 'mobile_money' then 1 else 2 end`,
      )
      .orderBy('name')
      .execute();
  }

  /** Sum and count of the movements of each account, up to `day` included. */
  private async sums(
    executor: Executor,
    organizationId: string,
    timeZone: string,
    until: string | null,
  ) {
    const { rows } = await sql<{
      account_id: string;
      total: string;
      count: string;
    }>`
      with ${movementsCte(organizationId, timeZone)}
      select account_id, coalesce(sum(amount), 0) as total, count(*) as count
        from mv
       where ${until === null ? sql`true` : sql`day <= ${until}`}
       group by account_id`.execute(executor);
    return new Map(
      rows.map((r) => [
        r.account_id,
        { total: toNumber(r.total), count: toNumber(r.count) },
      ]),
    );
  }

  private toDto(
    row: AccountRow,
    sum: { total: number; count: number } | undefined,
  ): CashAccountDto {
    const opening = toNumber(row.opening_balance);
    return {
      id: row.id,
      kind: row.kind,
      provider: row.provider,
      name: row.name,
      openingBalance: opening,
      balance: opening + (sum?.total ?? 0),
      used: row.kind === 'cash' || opening !== 0 || (sum?.count ?? 0) > 0,
    };
  }

  async treasury(tenant: TenantContext): Promise<TreasuryDto> {
    const db = this.database.db;
    const organizationId = tenant.organizationId;
    const timeZone = await this.timeZone(db, organizationId);
    const day = today(timeZone);
    const [rows, sums, flows, receivables] = await Promise.all([
      this.accounts(db, organizationId),
      this.sums(db, organizationId, timeZone, null),
      sql<{ money_in: string; money_out: string }>`
        with ${movementsCte(organizationId, timeZone)}
        select coalesce(sum(amount) filter (where amount > 0), 0) as money_in,
               coalesce(-sum(amount) filter (where amount < 0), 0) as money_out
          from mv
         where day = ${day} and kind not in ('transfer_in', 'transfer_out')`.execute(
        db,
      ),
      this.receivables(db, organizationId),
    ]);
    const accounts = rows.map((row) => this.toDto(row, sums.get(row.id)));
    return {
      accounts,
      total: accounts.reduce((sum, a) => sum + a.balance, 0),
      receivables,
      today: {
        day,
        moneyIn: toNumber(flows.rows[0]?.money_in ?? 0),
        moneyOut: toNumber(flows.rows[0]?.money_out ?? 0),
      },
    };
  }

  /** What customers owe on credit, and what issued invoices still await. */
  async receivables(executor: Executor, organizationId: string) {
    const { rows } = await sql<{ customers: string; invoices: string }>`
      select
        (select coalesce(sum(greatest(owed, 0)), 0) from (
           select c.id,
                  coalesce((select sum(p.amount) from app.sale_payments p
                              join app.sales s on s.organization_id = p.organization_id and s.id = p.sale_id
                             where p.organization_id = c.organization_id and s.customer_id = c.id
                               and p.method = 'credit' and s.status = 'completed'), 0)
                - coalesce((select sum(r.amount) from app.customer_payments r
                             where r.organization_id = c.organization_id and r.customer_id = c.id), 0) as owed
             from app.customers c where c.organization_id = ${organizationId}) o) as customers,
        (select coalesce(sum(greatest(i.total - coalesce(
                  (select sum(ip.amount) from app.invoice_payments ip
                    where ip.organization_id = i.organization_id and ip.invoice_id = i.id), 0), 0)), 0)
           from app.invoices i
          where i.organization_id = ${organizationId} and i.kind = 'invoice' and i.status = 'issued') as invoices`.execute(
      executor,
    );
    return {
      customers: toNumber(rows[0]!.customers),
      invoices: toNumber(rows[0]!.invoices),
    };
  }

  private async account(
    executor: Executor,
    organizationId: string,
    id: string,
    lock = false,
  ) {
    if (!UUID_RE.test(id)) throw accountNotFound();
    let query = executor
      .selectFrom('app.cash_accounts')
      .select(['id', 'kind', 'provider', 'name', 'opening_balance'])
      .where('organization_id', '=', organizationId)
      .where('id', '=', id);
    if (lock) query = query.forUpdate();
    const row = await query.executeTakeFirst();
    if (!row) throw accountNotFound();
    return row;
  }

  async lastClosingDay(
    executor: Executor,
    organizationId: string,
    accountId: string,
  ) {
    const row = await executor
      .selectFrom('app.cash_closings')
      .select(sql<string | null>`max(day)::text`.as('day'))
      .where('organization_id', '=', organizationId)
      .where('cash_account_id', '=', accountId)
      .executeTakeFirst();
    return row?.day ?? null;
  }

  async movements(
    tenant: TenantContext,
    query: MovementsQuery,
  ): Promise<CashMovementsDto> {
    const db = this.database.db;
    const organizationId = tenant.organizationId;
    const timeZone = await this.timeZone(db, organizationId);
    const row = await this.account(db, organizationId, query.accountId);
    const to = query.to ?? today(timeZone);
    const from = query.from ?? addDays(to, -30);
    if (from > to) throw invalid('to', 'La fin est avant le début.');
    const [before, inPeriod, untilTo, allSums, lastClosingDay] =
      await Promise.all([
        this.sums(db, organizationId, timeZone, addDays(from, -1)),
        sql<{
          kind: CashMovementKind;
          amount: string;
          day: string;
          label: string;
          source_id: string | null;
        }>`
        with ${movementsCte(organizationId, timeZone)}
        select kind, amount, day::text as day, label, source_id
          from mv
         where account_id = ${row.id} and day between ${from} and ${to}
         order by day desc, kind
         limit 500`.execute(db),
        this.sums(db, organizationId, timeZone, to),
        this.sums(db, organizationId, timeZone, null),
        this.lastClosingDay(db, organizationId, row.id),
      ]);
    const opening = toNumber(row.opening_balance);
    return {
      account: this.toDto(row, allSums.get(row.id)),
      from,
      to,
      startBalance: opening + (before.get(row.id)?.total ?? 0),
      endBalance: opening + (untilTo.get(row.id)?.total ?? 0),
      movements: inPeriod.rows.map((m): CashMovementDto => ({
        kind: m.kind,
        amount: toNumber(m.amount),
        day: m.day,
        label: m.label,
        sourceId: m.source_id,
      })),
      lastClosingDay,
    };
  }

  async updateAccount(
    tenant: TenantContext,
    user: AuthContext,
    id: string,
    input: UpdateCashAccountInput,
    requestId: string | null,
  ): Promise<CashAccountDto> {
    return this.database.db.transaction().execute(async (trx) => {
      const before = await this.account(trx, tenant.organizationId, id, true);
      const set: { name?: string; opening_balance?: number } = {};
      if (input.name !== undefined) set.name = input.name;
      if (input.openingBalance !== undefined) {
        // Changing the past of a counted account would falsify its counts.
        if (await this.lastClosingDay(trx, tenant.organizationId, id))
          throw conflict(
            'ACCOUNT_ALREADY_COUNTED',
            'Cette caisse a déjà été clôturée : son solde de départ ne change plus.',
          );
        set.opening_balance = input.openingBalance;
      }
      if (Object.keys(set).length > 0)
        await trx
          .updateTable('app.cash_accounts')
          .set(set)
          .where('organization_id', '=', tenant.organizationId)
          .where('id', '=', id)
          .execute();
      await this.audit.record(trx, {
        organizationId: tenant.organizationId,
        actorType: 'user',
        actorId: user.userId,
        action: 'cash_account.updated',
        targetType: 'cash_account',
        targetId: id,
        metadata: {
          ...(set.name !== undefined && {
            name: { from: before.name, to: set.name },
          }),
          ...(set.opening_balance !== undefined && {
            openingBalance: {
              from: toNumber(before.opening_balance),
              to: set.opening_balance,
            },
          }),
        },
        requestId,
      });
      const timeZone = await this.timeZone(trx, tenant.organizationId);
      const sums = await this.sums(trx, tenant.organizationId, timeZone, null);
      const row = await this.account(trx, tenant.organizationId, id);
      return this.toDto(row, sums.get(id));
    });
  }

  /** Refuses a day already counted on one of the accounts. */
  async assertOpenDay(
    executor: Executor,
    organizationId: string,
    accountIds: string[],
    day: string,
    field: string,
  ) {
    const timeZone = await this.timeZone(executor, organizationId);
    if (day > today(timeZone))
      throw invalid(field, 'Cette date est dans le futur.');
    for (const accountId of accountIds) {
      const last = await this.lastClosingDay(
        executor,
        organizationId,
        accountId,
      );
      if (last && day <= last)
        throw conflict(
          'DAY_ALREADY_CLOSED',
          `La caisse a été clôturée le ${last.split('-').reverse().join('/')} : choisissez une date après.`,
        );
    }
  }

  async createTransfer(
    tenant: TenantContext,
    user: AuthContext,
    input: CreateTransferInput,
    requestId: string | null,
  ): Promise<{ replayed: boolean; treasury: TreasuryDto }> {
    try {
      const replayed = await this.database.db
        .transaction()
        .execute(async (trx) => {
          const previous = await trx
            .selectFrom('app.cash_transfers')
            .select('id')
            .where('organization_id', '=', tenant.organizationId)
            .where('client_operation_id', '=', input.clientOperationId)
            .executeTakeFirst();
          if (previous) return true;
          const from = await this.account(
            trx,
            tenant.organizationId,
            input.fromAccountId,
            true,
          );
          const to = await this.account(
            trx,
            tenant.organizationId,
            input.toAccountId,
            true,
          );
          await this.assertOpenDay(
            trx,
            tenant.organizationId,
            [from.id, to.id],
            input.occurredOn,
            'occurredOn',
          );
          const { id } = await trx
            .insertInto('app.cash_transfers')
            .values({
              organization_id: tenant.organizationId,
              from_account_id: from.id,
              to_account_id: to.id,
              amount: input.amount,
              occurred_on: input.occurredOn,
              note: input.note,
              client_operation_id: input.clientOperationId,
              created_by: user.userId,
            })
            .returning('id')
            .executeTakeFirstOrThrow();
          await this.audit.record(trx, {
            organizationId: tenant.organizationId,
            actorType: 'user',
            actorId: user.userId,
            action: 'cash_transfer.created',
            targetType: 'cash_transfer',
            targetId: id,
            metadata: { from: from.name, to: to.name, amount: input.amount },
            requestId,
          });
          return false;
        });
      return { replayed, treasury: await this.treasury(tenant) };
    } catch (error) {
      if (pgErrorCode(error) === UNIQUE_VIOLATION)
        return { replayed: true, treasury: await this.treasury(tenant) };
      throw error;
    }
  }

  private async closingDto(
    executor: Executor,
    organizationId: string,
    id: string,
  ): Promise<ClosingDto> {
    const row = await executor
      .selectFrom('app.cash_closings as k')
      .innerJoin('app.cash_accounts as a', (join) =>
        join
          .onRef('a.organization_id', '=', 'k.organization_id')
          .onRef('a.id', '=', 'k.cash_account_id'),
      )
      .innerJoin('app.user_profiles as u', 'u.id', 'k.closed_by')
      .select([
        'k.id',
        'k.cash_account_id',
        'a.name as account_name',
        'k.expected_amount',
        'k.counted_amount',
        'k.difference',
        'k.note',
        'k.closed_by',
        'u.email',
        'k.created_at',
      ])
      .select(sql<string>`k.day::text`.as('day_text'))
      .where('k.organization_id', '=', organizationId)
      .where('k.id', '=', id)
      .executeTakeFirstOrThrow();
    return {
      id: row.id,
      account: { id: row.cash_account_id, name: row.account_name },
      day: row.day_text,
      expectedAmount: toNumber(row.expected_amount),
      countedAmount: toNumber(row.counted_amount),
      difference: toNumber(row.difference),
      note: row.note,
      closedBy: { userId: row.closed_by, email: row.email },
      createdAt: row.created_at.toISOString(),
    };
  }

  async listClosings(
    tenant: TenantContext,
    accountId: string | undefined,
  ): Promise<ClosingDto[]> {
    const db = this.database.db;
    let query = db
      .selectFrom('app.cash_closings')
      .select('id')
      .where('organization_id', '=', tenant.organizationId);
    if (accountId) {
      await this.account(db, tenant.organizationId, accountId);
      query = query.where('cash_account_id', '=', accountId);
    }
    const ids = await query
      .orderBy('day', 'desc')
      .orderBy('created_at', 'desc')
      .limit(60)
      .execute();
    return Promise.all(
      ids.map((r) => this.closingDto(db, tenant.organizationId, r.id)),
    );
  }

  /** Opening balance plus the movements up to the end of `day`. */
  private async expected(
    executor: Executor,
    organizationId: string,
    account: AccountRow,
    day: string,
  ) {
    const timeZone = await this.timeZone(executor, organizationId);
    const { rows } = await sql<{
      total: string;
      money_in: string;
      money_out: string;
    }>`
      with ${movementsCte(organizationId, timeZone)}
      select coalesce(sum(amount) filter (where day <= ${day}), 0) as total,
             coalesce(sum(amount) filter (where day = ${day} and amount > 0), 0) as money_in,
             coalesce(-sum(amount) filter (where day = ${day} and amount < 0), 0) as money_out
        from mv
       where account_id = ${account.id}`.execute(executor);
    return {
      expectedAmount:
        toNumber(account.opening_balance) + toNumber(rows[0]!.total),
      moneyIn: toNumber(rows[0]!.money_in),
      moneyOut: toNumber(rows[0]!.money_out),
    };
  }

  async expectedClosing(
    tenant: TenantContext,
    accountId: string,
    day: string,
  ): Promise<ExpectedClosingDto> {
    const db = this.database.db;
    const account = await this.account(db, tenant.organizationId, accountId);
    const existing = await db
      .selectFrom('app.cash_closings')
      .select('id')
      .where('organization_id', '=', tenant.organizationId)
      .where('cash_account_id', '=', account.id)
      .where('day', '=', day)
      .executeTakeFirst();
    const closing = existing
      ? await this.closingDto(db, tenant.organizationId, existing.id)
      : null;
    const figures = await this.expected(
      db,
      tenant.organizationId,
      account,
      day,
    );
    return {
      accountId: account.id,
      day,
      // Once counted, the day's closing is part of the movements.
      expectedAmount: closing ? closing.expectedAmount : figures.expectedAmount,
      moneyIn: figures.moneyIn,
      moneyOut: figures.moneyOut,
      closing,
    };
  }

  async createClosing(
    tenant: TenantContext,
    user: AuthContext,
    input: CreateClosingInput,
    requestId: string | null,
  ): Promise<{ closing: ClosingDto; replayed: boolean }> {
    const replay = async (executor: Executor) => {
      const previous = await executor
        .selectFrom('app.cash_closings')
        .select('id')
        .where('organization_id', '=', tenant.organizationId)
        .where('client_operation_id', '=', input.clientOperationId)
        .executeTakeFirst();
      return previous
        ? this.closingDto(executor, tenant.organizationId, previous.id)
        : null;
    };
    try {
      return await this.database.db
        .transaction()
        .execute(async (trx: Transaction<Database>) => {
          const previous = await replay(trx);
          if (previous) return { closing: previous, replayed: true };
          const account = await this.account(
            trx,
            tenant.organizationId,
            input.cashAccountId,
            true,
          );
          const timeZone = await this.timeZone(trx, tenant.organizationId);
          if (input.day > today(timeZone))
            throw invalid('day', 'On ne clôture pas un jour à venir.');
          const last = await this.lastClosingDay(
            trx,
            tenant.organizationId,
            account.id,
          );
          if (last && input.day <= last)
            throw conflict(
              'DAY_ALREADY_CLOSED',
              last === input.day
                ? 'Cette journée est déjà clôturée pour cette caisse.'
                : `La caisse a déjà été clôturée le ${last.split('-').reverse().join('/')}.`,
            );
          const { expectedAmount } = await this.expected(
            trx,
            tenant.organizationId,
            account,
            input.day,
          );
          const { id } = await trx
            .insertInto('app.cash_closings')
            .values({
              organization_id: tenant.organizationId,
              cash_account_id: account.id,
              day: input.day,
              expected_amount: expectedAmount,
              counted_amount: input.countedAmount,
              difference: input.countedAmount - expectedAmount,
              note: input.note,
              client_operation_id: input.clientOperationId,
              closed_by: user.userId,
            })
            .returning('id')
            .executeTakeFirstOrThrow();
          await this.audit.record(trx, {
            organizationId: tenant.organizationId,
            actorType: 'user',
            actorId: user.userId,
            action: 'cash_closing.created',
            targetType: 'cash_closing',
            targetId: id,
            metadata: {
              account: account.name,
              day: input.day,
              expected: expectedAmount,
              counted: input.countedAmount,
              difference: input.countedAmount - expectedAmount,
            },
            requestId,
          });
          return {
            closing: await this.closingDto(trx, tenant.organizationId, id),
            replayed: false,
          };
        });
    } catch (error) {
      if (pgErrorCode(error) === UNIQUE_VIOLATION) {
        const previous = await replay(this.database.db);
        if (previous) return { closing: previous, replayed: true };
        throw conflict(
          'DAY_ALREADY_CLOSED',
          'Cette journée est déjà clôturée pour cette caisse.',
        );
      }
      throw error;
    }
  }
}
