import { Injectable } from '@nestjs/common';
import {
  accountOfMovement,
  ACCOUNTS,
  amountInputValue,
  TREASURY_ACCOUNTS,
  type CashAccountKind,
  type CashMovementKind,
  type JournalDto,
  type JournalEntryDto,
  type PeriodQuery,
  type StatementDto,
} from '@nagaw/shared';
import { sql } from 'kysely';
import { invalid, toNumber } from '../catalog/catalog.errors.js';
import type { TenantContext } from '../common/request-context.js';
import { today } from '../common/today.js';
import { DatabaseService } from '../database/database.service.js';
import { movementsCte } from '../treasury/movements.js';
import { TreasuryService } from '../treasury/treasury.service.js';

const JOURNAL_LIMIT = 5000;
const SALE_KINDS: CashMovementKind[] = [
  'sale',
  'sale_cancelled',
  'repayment',
  'invoice_payment',
];

interface JournalRow {
  day: string;
  kind: CashMovementKind;
  amount: string;
  label: string;
  cash_id: string;
  cash_name: string;
  cash_kind: CashAccountKind;
  expense_number: string | null;
  account_code: string | null;
  category_name: string | null;
}

function describe(row: JournalRow): { voucher: string; label: string } {
  switch (row.kind) {
    case 'sale':
      return { voucher: `Ticket n° ${row.label}`, label: 'Vente au comptoir' };
    case 'sale_cancelled':
      return {
        voucher: `Ticket n° ${row.label}`,
        label: 'Annulation de la vente',
      };
    case 'repayment':
      return { voucher: '', label: `Remboursement de ${row.label}` };
    case 'invoice_payment':
      return {
        voucher: row.label,
        label: `Paiement de la facture ${row.label}`,
      };
    case 'expense':
      return { voucher: row.expense_number ?? '', label: row.label };
    case 'transfer_in':
      return { voucher: '', label: `Reçu de ${row.label}` };
    case 'transfer_out':
      return { voucher: '', label: `Envoyé vers ${row.label}` };
    case 'closing':
      return {
        voucher: '',
        label: row.label
          ? `Écart de clôture (${row.label})`
          : 'Écart de clôture',
      };
  }
}

/** « 24/10/2026 », as an accountant types it. */
const frenchDay = (day: string) => day.split('-').reverse().join('/');

/** CSV for a spreadsheet set to French: `;`, BOM, CRLF. */
function csv(rows: (string | number)[][]): string {
  const cell = (value: string | number) => {
    const text = String(value);
    return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return `﻿${rows.map((row) => row.map(cell).join(';')).join('\r\n')}\r\n`;
}

/**
 * Minimal cash system of the revised SYSCOHADA (ADR-028): the journal of
 * receipts and expenses and the end of year statement, both computed from
 * the money movements of the treasury (ADR-027).
 */
@Injectable()
export class AccountingService {
  constructor(
    private readonly database: DatabaseService,
    private readonly treasury: TreasuryService,
  ) {}

  private async rows(
    organizationId: string,
    timeZone: string,
    from: string,
    to: string,
    limit: number | null,
  ) {
    const { rows } = await sql<JournalRow>`
      with ${movementsCte(organizationId, timeZone)}
      select mv.day::text as day, mv.kind, mv.amount, mv.label,
             a.id as cash_id, a.name as cash_name, a.kind as cash_kind,
             e.number as expense_number, c.account_code, c.name as category_name
        from mv
        join acc a on a.id = mv.account_id
        left join app.expenses e
          on mv.kind = 'expense' and e.organization_id = ${organizationId} and e.id = mv.source_id
        left join app.expense_categories c
          on c.organization_id = e.organization_id and c.id = e.category_id
       where mv.day between ${from} and ${to}
       order by mv.day, a.name, mv.kind, mv.label
       ${limit === null ? sql`` : sql`limit ${limit}`}`.execute(
      this.database.db,
    );
    return rows;
  }

  private entry(row: JournalRow): JournalEntryDto {
    const amount = toNumber(row.amount);
    const account = accountOfMovement(
      row.kind,
      amount,
      row.account_code
        ? { code: row.account_code, label: row.category_name ?? '' }
        : null,
    );
    return {
      day: row.day,
      ...describe(row),
      kind: row.kind,
      account,
      cashAccount: {
        id: row.cash_id,
        name: row.cash_name,
        code: TREASURY_ACCOUNTS[row.cash_kind].code,
      },
      receipt: Math.max(amount, 0),
      expense: Math.max(-amount, 0),
    };
  }

  private async period(organizationId: string, query: PeriodQuery) {
    const timeZone = await this.treasury.timeZone(
      this.database.db,
      organizationId,
    );
    const to = query.to ?? today(timeZone);
    const from = query.from ?? `${to.slice(0, 7)}-01`;
    if (from > to) throw invalid('to', 'La fin est avant le début.');
    return { timeZone, from, to };
  }

  async journal(
    tenant: TenantContext,
    query: PeriodQuery,
  ): Promise<JournalDto> {
    const { timeZone, from, to } = await this.period(
      tenant.organizationId,
      query,
    );
    const rows = await this.rows(
      tenant.organizationId,
      timeZone,
      from,
      to,
      JOURNAL_LIMIT + 1,
    );
    const entries = rows.slice(0, JOURNAL_LIMIT).map((row) => this.entry(row));
    return {
      from,
      to,
      entries,
      totals: {
        receipts: entries.reduce((sum, e) => sum + e.receipt, 0),
        expenses: entries.reduce((sum, e) => sum + e.expense, 0),
      },
      truncated: rows.length > JOURNAL_LIMIT,
    };
  }

  /** The whole journal of the period, for the accountant. */
  async journalCsv(
    tenant: TenantContext,
    query: PeriodQuery,
  ): Promise<{ name: string; body: string }> {
    const { timeZone, from, to } = await this.period(
      tenant.organizationId,
      query,
    );
    const currency = await this.currency(tenant.organizationId);
    const money = (minor: number) =>
      minor === 0 ? '' : amountInputValue(minor, currency);
    const entries = (
      await this.rows(tenant.organizationId, timeZone, from, to, null)
    ).map((row) => this.entry(row));
    return {
      name: `journal-recettes-depenses-${from}-${to}.csv`,
      body: csv([
        [
          'Date',
          'Pièce',
          'Libellé',
          'Compte',
          'Intitulé du compte',
          'Trésorerie',
          'Compte de trésorerie',
          `Recette (${currency})`,
          `Dépense (${currency})`,
        ],
        ...entries.map((e) => [
          frenchDay(e.day),
          e.voucher,
          e.label,
          e.account.code,
          e.account.label,
          e.cashAccount.name,
          e.cashAccount.code,
          money(e.receipt),
          money(e.expense),
        ]),
      ]),
    };
  }

  private async currency(organizationId: string): Promise<string> {
    const { default_currency } = await this.database.db
      .selectFrom('app.organizations')
      .select('default_currency')
      .where('id', '=', organizationId)
      .executeTakeFirstOrThrow();
    return default_currency;
  }

  async statement(tenant: TenantContext, year: number): Promise<StatementDto> {
    const db = this.database.db;
    const organizationId = tenant.organizationId;
    const timeZone = await this.treasury.timeZone(db, organizationId);
    const now = today(timeZone);
    const from = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;
    if (from > now) throw invalid('year', 'Cet exercice n’a pas commencé.');
    const to = yearEnd < now ? yearEnd : now;

    const [grouped, balances, accounts, receivables, stock] = await Promise.all(
      [
        sql<{
          kind: CashMovementKind;
          positive: boolean;
          code: string | null;
          name: string | null;
          amount: string;
        }>`
        with ${movementsCte(organizationId, timeZone)}
        select mv.kind, mv.amount > 0 as positive, c.account_code as code, c.name, sum(mv.amount) as amount
          from mv
          left join app.expenses e
            on mv.kind = 'expense' and e.organization_id = ${organizationId} and e.id = mv.source_id
          left join app.expense_categories c
            on c.organization_id = e.organization_id and c.id = e.category_id
         where mv.day between ${from} and ${to} and mv.kind not in ('transfer_in', 'transfer_out')
         group by mv.kind, mv.amount > 0, c.account_code, c.name`.execute(db),
        sql<{ account_id: string; start: string; end: string }>`
        with ${movementsCte(organizationId, timeZone)}
        select account_id,
               coalesce(sum(amount) filter (where day < ${from}), 0) as start,
               coalesce(sum(amount) filter (where day <= ${to}), 0) as end
          from mv group by account_id`.execute(db),
        db
          .selectFrom('app.cash_accounts')
          .select(['id', 'name', 'kind', 'opening_balance'])
          .where('organization_id', '=', organizationId)
          .orderBy(
            sql`case kind when 'cash' then 0 when 'mobile_money' then 1 else 2 end`,
          )
          .orderBy('name')
          .execute(),
        this.receivablesAt(organizationId, timeZone, to),
        sql<{ value: string; unvalued: string }>`
        select coalesce(sum(st.quantity * p.purchase_price) filter (where p.purchase_price is not null and st.quantity > 0), 0) as value,
               count(*) filter (where p.purchase_price is null and st.quantity > 0) as unvalued
          from app.products p
          join (select product_id, sum(quantity) as quantity from app.stock_movements
                 where organization_id = ${organizationId}
                   and (occurred_at at time zone ${timeZone})::date <= ${to}
                 group by product_id) st on st.product_id = p.id
         where p.organization_id = ${organizationId} and p.track_stock`.execute(
          db,
        ),
      ],
    );

    const receipts = new Map<
      string,
      { code: string; label: string; amount: number }
    >();
    const expenses = new Map<
      string,
      { code: string; label: string; amount: number }
    >();
    const add = (
      target: typeof receipts,
      account: { code: string; label: string },
      amount: number,
    ) => {
      const line = target.get(account.code) ?? { ...account, amount: 0 };
      line.amount += amount;
      target.set(account.code, line);
    };
    for (const g of grouped.rows) {
      const amount = toNumber(g.amount);
      if (SALE_KINDS.includes(g.kind)) add(receipts, ACCOUNTS.sales, amount);
      else if (g.kind === 'closing') {
        if (g.positive) add(receipts, ACCOUNTS.cashGain, amount);
        else add(expenses, ACCOUNTS.cashLoss, -amount);
      } else if (g.kind === 'expense')
        add(
          expenses,
          g.code ? { code: g.code, label: g.name ?? '' } : ACCOUNTS.cashLoss,
          -amount,
        );
    }
    const byCode = (a: { code: string }, b: { code: string }) =>
      a.code.localeCompare(b.code);
    const receiptLines = [...receipts.values()].sort(byCode);
    const expenseLines = [...expenses.values()].sort(byCode);
    const totalReceipts = receiptLines.reduce((s, l) => s + l.amount, 0);
    const totalExpenses = expenseLines.reduce((s, l) => s + l.amount, 0);

    const sums = new Map(balances.rows.map((r) => [r.account_id, r]));
    const treasuryAccounts = accounts.map((a) => {
      const opening = toNumber(a.opening_balance);
      const s = sums.get(a.id);
      return {
        id: a.id,
        name: a.name,
        code: TREASURY_ACCOUNTS[a.kind].code,
        start: opening + toNumber(s?.start ?? 0),
        end: opening + toNumber(s?.end ?? 0),
      };
    });

    return {
      year,
      from,
      to,
      provisional: to < yearEnd,
      receipts: receiptLines,
      expenses: expenseLines,
      totals: {
        receipts: totalReceipts,
        expenses: totalExpenses,
        result: totalReceipts - totalExpenses,
      },
      treasury: {
        accounts: treasuryAccounts,
        start: treasuryAccounts.reduce((s, a) => s + a.start, 0),
        end: treasuryAccounts.reduce((s, a) => s + a.end, 0),
      },
      receivables,
      stock: {
        value: Math.round(toNumber(stock.rows[0]!.value)),
        unvaluedProducts: toNumber(stock.rows[0]!.unvalued),
      },
    };
  }

  /** What customers and invoices still owed at the end of `day`. */
  private async receivablesAt(
    organizationId: string,
    timeZone: string,
    day: string,
  ) {
    const { rows } = await sql<{ customers: string; invoices: string }>`
      select
        (select coalesce(sum(greatest(owed, 0)), 0) from (
           select coalesce((select sum(p.amount) from app.sale_payments p
                              join app.sales s on s.organization_id = p.organization_id and s.id = p.sale_id
                             where p.organization_id = c.organization_id and s.customer_id = c.id
                               and p.method = 'credit'
                               and (s.occurred_at at time zone ${timeZone})::date <= ${day}
                               and (s.status = 'completed'
                                    or (s.cancelled_at at time zone ${timeZone})::date > ${day})), 0)
                - coalesce((select sum(r.amount) from app.customer_payments r
                             where r.organization_id = c.organization_id and r.customer_id = c.id
                               and (r.created_at at time zone ${timeZone})::date <= ${day}), 0) as owed
             from app.customers c where c.organization_id = ${organizationId}) o) as customers,
        (select coalesce(sum(greatest(i.total - coalesce(
                  (select sum(ip.amount) from app.invoice_payments ip
                    where ip.organization_id = i.organization_id and ip.invoice_id = i.id
                      and ip.paid_on <= ${day}), 0), 0)), 0)
           from app.invoices i
          where i.organization_id = ${organizationId} and i.kind = 'invoice'
            and i.issue_date <= ${day}
            and (i.status = 'issued' or (i.cancelled_at at time zone ${timeZone})::date > ${day})) as invoices`.execute(
      this.database.db,
    );
    return {
      customers: toNumber(rows[0]!.customers),
      invoices: toNumber(rows[0]!.invoices),
    };
  }

  async statementCsv(
    tenant: TenantContext,
    year: number,
  ): Promise<{ name: string; body: string }> {
    const s = await this.statement(tenant, year);
    const currency = await this.currency(tenant.organizationId);
    const money = (minor: number) =>
      `${minor < 0 ? '-' : ''}${amountInputValue(Math.abs(minor), currency)}`;
    return {
      name: `etat-fin-exercice-${year}.csv`,
      body: csv([
        [
          `État de fin d’exercice ${year} — système minimal de trésorerie (SYSCOHADA)`,
        ],
        [
          `Du ${frenchDay(s.from)} au ${frenchDay(s.to)}${s.provisional ? ' (provisoire)' : ''}`,
          '',
          `Montants en ${currency}`,
        ],
        [],
        ['Recettes', 'Compte', 'Montant'],
        ...s.receipts.map((l) => [l.label, l.code, money(l.amount)]),
        ['Total des recettes', '', money(s.totals.receipts)],
        [],
        ['Dépenses', 'Compte', 'Montant'],
        ...s.expenses.map((l) => [l.label, l.code, money(l.amount)]),
        ['Total des dépenses', '', money(s.totals.expenses)],
        [],
        ['Résultat (recettes - dépenses)', '', money(s.totals.result)],
        [],
        ['Trésorerie', 'Compte', 'Au début', 'À la fin'],
        ...s.treasury.accounts.map((a) => [
          a.name,
          a.code,
          money(a.start),
          money(a.end),
        ]),
        ['Total', '', money(s.treasury.start), money(s.treasury.end)],
        [],
        ['Créances clients (crédit)', '411', money(s.receivables.customers)],
        ['Factures à encaisser', '411', money(s.receivables.invoices)],
        ['Stock au prix d’achat (estimation)', '31', money(s.stock.value)],
        ...(s.stock.unvaluedProducts > 0
          ? [
              [
                `Produits en stock sans prix d’achat : ${s.stock.unvaluedProducts}`,
              ],
            ]
          : []),
      ]),
    };
  }
}
