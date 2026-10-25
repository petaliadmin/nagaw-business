import { HttpStatus, Injectable } from '@nestjs/common';
import {
  canChangeQuoteStatus,
  computeDocumentTotals,
  formatDocumentNumber,
  quantityFitsUnit,
  UNITS,
  type CancelInvoiceInput,
  type CreateInvoiceInput,
  type CreateQuoteInput,
  type DocumentCustomerDto,
  type DocumentLine,
  type DocumentListItemDto,
  type InvoiceDto,
  type InvoicePaymentInput,
  type InvoicePaymentState,
  type QuoteDto,
  type QuoteStatus,
  type ShopIdentityDto,
  type UpdateInvoiceInput,
  type UpdateQuoteInput,
} from '@nagaw/shared';
import { sql, type Transaction } from 'kysely';
import { AuditService } from '../audit/audit.service.js';
import { ApiException } from '../common/api-exception.js';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { today } from '../common/today.js';
import { DatabaseService } from '../database/database.service.js';
import { pgErrorCode, UNIQUE_VIOLATION } from '../database/pg-errors.js';
import type { Database } from '../database/schema.js';
import {
  conflict,
  invalid,
  notFound,
  toNumber,
  UUID_RE,
  type Executor,
} from '../catalog/catalog.errors.js';

const quoteNotFound = () => notFound('QUOTE_NOT_FOUND', 'Devis introuvable.');
const invoiceNotFound = () =>
  notFound('INVOICE_NOT_FOUND', 'Facture introuvable.');

/** YYYY-MM-DD plus n days (calendar arithmetic, no time zone involved). */
function addDays(day: string, n: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

function paymentState(total: number, paid: number): InvoicePaymentState {
  if (paid <= 0) return 'unpaid';
  return paid >= total ? 'paid' : 'partially_paid';
}

/**
 * Quotes, invoices and credit notes (ADR-026). Legal numbers come from
 * `document_sequences`, locked per shop, kind and year; an issued invoice
 * never changes (database trigger) and is cancelled by a credit note.
 */
@Injectable()
export class DocumentsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  // -------------------------------------------------------------------------
  // Shared helpers
  // -------------------------------------------------------------------------

  async shop(executor: Executor, organizationId: string) {
    return executor
      .selectFrom('app.organizations')
      .select([
        'name',
        'legal_name',
        'address',
        'phone',
        'email',
        'tax_id',
        'trade_register',
        'invoice_footer',
        'invoice_due_days',
        'quote_validity_days',
        'timezone',
        'default_currency',
      ])
      .where('id', '=', organizationId)
      .executeTakeFirstOrThrow();
  }

  identity(
    shop: Awaited<ReturnType<DocumentsService['shop']>>,
  ): ShopIdentityDto {
    return {
      name: shop.name,
      legalName: shop.legal_name,
      address: shop.address,
      phone: shop.phone,
      email: shop.email,
      taxId: shop.tax_id,
      tradeRegister: shop.trade_register,
      invoiceFooter: shop.invoice_footer,
      invoiceDueDays: shop.invoice_due_days,
      quoteValidityDays: shop.quote_validity_days,
    };
  }

  /** Next legal number, without gap: the sequence row is locked. */
  private async nextNumber(
    trx: Transaction<Database>,
    organizationId: string,
    kind: 'quote' | 'invoice' | 'credit_note',
    day: string,
  ): Promise<string> {
    const year = Number(day.slice(0, 4));
    await trx
      .insertInto('app.document_sequences')
      .values({ organization_id: organizationId, kind, year })
      .onConflict((oc) => oc.doNothing())
      .execute();
    const { next_number } = await trx
      .selectFrom('app.document_sequences')
      .select('next_number')
      .where('organization_id', '=', organizationId)
      .where('kind', '=', kind)
      .where('year', '=', year)
      .forUpdate()
      .executeTakeFirstOrThrow();
    await trx
      .updateTable('app.document_sequences')
      .set({ next_number: next_number + 1 })
      .where('organization_id', '=', organizationId)
      .where('kind', '=', kind)
      .where('year', '=', year)
      .execute();
    return formatDocumentNumber(kind, year, next_number);
  }

  private async customer(
    executor: Executor,
    organizationId: string,
    id: string,
  ): Promise<DocumentCustomerDto> {
    const row = UUID_RE.test(id)
      ? await executor
          .selectFrom('app.customers')
          .select([
            'id',
            'name',
            'phone',
            'email',
            'address',
            'tax_id',
            'status',
          ])
          .where('organization_id', '=', organizationId)
          .where('id', '=', id)
          .executeTakeFirst()
      : undefined;
    if (!row) throw invalid('customerId', 'Client inconnu.');
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      email: row.email,
      address: row.address,
      taxId: row.tax_id,
    };
  }

  /** Catalogue lines must be products of this shop; units stay coherent. */
  private async checkLines(
    executor: Executor,
    organizationId: string,
    lines: DocumentLine[],
  ): Promise<void> {
    const ids = [
      ...new Set(lines.flatMap((l) => (l.productId ? [l.productId] : []))),
    ];
    const known = ids.length
      ? new Set(
          (
            await executor
              .selectFrom('app.products')
              .select('id')
              .where('organization_id', '=', organizationId)
              .where('id', 'in', ids)
              .execute()
          ).map((p) => p.id),
        )
      : new Set<string>();
    lines.forEach((line, index) => {
      if (line.productId && !known.has(line.productId))
        throw invalid(`lines.${index}.productId`, 'Produit inconnu.');
      if (!quantityFitsUnit(line.quantity, line.unit))
        throw invalid(
          `lines.${index}.quantity`,
          `Nombre entier attendu (unité : ${UNITS[line.unit].label}).`,
        );
    });
  }

  private totalsColumns(lines: DocumentLine[], discount: number) {
    const totals = computeDocumentTotals(lines, discount);
    if (discount > totals.subtotal)
      throw invalid('discount', 'La remise dépasse le montant du document.');
    return {
      totals,
      columns: {
        subtotal: totals.subtotal,
        discount: totals.discount,
        total: totals.total,
        tax_total: totals.taxTotal,
      },
    };
  }

  private withLineTotals(lines: DocumentLine[], discount: number) {
    const totals = computeDocumentTotals(lines, discount);
    return {
      totals,
      lines: lines.map((line, index) => ({
        ...line,
        lineTotal: totals.lineTotals[index]!,
      })),
    };
  }

  // -------------------------------------------------------------------------
  // Quotes
  // -------------------------------------------------------------------------

  async getQuote(
    executor: Executor,
    organizationId: string,
    id: string,
  ): Promise<QuoteDto> {
    if (!UUID_RE.test(id)) throw quoteNotFound();
    const row = await executor
      .selectFrom('app.quotes as q')
      .selectAll('q')
      .select(sql<string>`q.issue_date::text`.as('issue_day'))
      .select(sql<string>`q.valid_until::text`.as('valid_day'))
      .where('q.organization_id', '=', organizationId)
      .where('q.id', '=', id)
      .executeTakeFirst();
    if (!row) throw quoteNotFound();
    const [customer, invoice, shop] = await Promise.all([
      this.customer(executor, organizationId, row.customer_id),
      executor
        .selectFrom('app.invoices')
        .select(['id', 'number'])
        .where('organization_id', '=', organizationId)
        .where('quote_id', '=', id)
        .where('kind', '=', 'invoice')
        .executeTakeFirst(),
      this.shop(executor, organizationId),
    ]);
    const { lines, totals } = this.withLineTotals(
      row.lines,
      toNumber(row.discount),
    );
    return {
      id: row.id,
      number: row.number,
      status: row.status,
      expired:
        (row.status === 'draft' || row.status === 'sent') &&
        row.valid_day < today(shop.timezone),
      issueDate: row.issue_day,
      validUntil: row.valid_day,
      customer,
      lines,
      notes: row.notes,
      totals,
      invoice: invoice ? { id: invoice.id, number: invoice.number } : null,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  async listQuotes(organizationId: string): Promise<DocumentListItemDto[]> {
    const { timezone } = await this.shop(this.database.db, organizationId);
    const day = today(timezone);
    const rows = await this.database.db
      .selectFrom('app.quotes as q')
      .innerJoin('app.customers as c', (join) =>
        join
          .onRef('c.organization_id', '=', 'q.organization_id')
          .onRef('c.id', '=', 'q.customer_id'),
      )
      .select([
        'q.id',
        'q.number',
        'q.status',
        'q.total',
        'c.name as customer_name',
      ])
      .select(sql<string>`q.issue_date::text`.as('issue_day'))
      .select(sql<string>`q.valid_until::text`.as('valid_day'))
      .where('q.organization_id', '=', organizationId)
      .orderBy('q.created_at', 'desc')
      .limit(200)
      .execute();
    return rows.map((row) => ({
      id: row.id,
      kind: 'quote',
      number: row.number,
      customerName: row.customer_name,
      status: row.status,
      paymentState: null,
      expired:
        (row.status === 'draft' || row.status === 'sent') &&
        row.valid_day < day,
      overdue: false,
      total: toNumber(row.total),
      balance: null,
      date: row.issue_day,
    }));
  }

  async createQuote(
    tenant: TenantContext,
    user: AuthContext,
    input: CreateQuoteInput,
    requestId: string | null,
  ): Promise<{ quote: QuoteDto; replayed: boolean }> {
    return this.database.db.transaction().execute(async (trx) => {
      const previous = await trx
        .selectFrom('app.quotes')
        .select('id')
        .where('organization_id', '=', tenant.organizationId)
        .where('client_operation_id', '=', input.clientOperationId)
        .executeTakeFirst();
      if (previous)
        return {
          quote: await this.getQuote(trx, tenant.organizationId, previous.id),
          replayed: true,
        };
      const shop = await this.shop(trx, tenant.organizationId);
      const day = today(shop.timezone);
      const validUntil =
        input.validUntil ?? addDays(day, shop.quote_validity_days);
      if (validUntil < day)
        throw invalid('validUntil', 'La date de validité est passée.');
      await this.customer(trx, tenant.organizationId, input.customerId);
      await this.checkLines(trx, tenant.organizationId, input.lines);
      const { columns } = this.totalsColumns(input.lines, input.discount);
      const number = await this.nextNumber(
        trx,
        tenant.organizationId,
        'quote',
        day,
      );
      const { id } = await trx
        .insertInto('app.quotes')
        .values({
          organization_id: tenant.organizationId,
          number,
          customer_id: input.customerId,
          issue_date: day,
          valid_until: validUntil,
          lines: JSON.stringify(input.lines),
          notes: input.notes,
          ...columns,
          client_operation_id: input.clientOperationId,
          created_by: user.userId,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await this.audit.record(trx, {
        organizationId: tenant.organizationId,
        actorType: 'user',
        actorId: user.userId,
        action: 'quote.created',
        targetType: 'quote',
        targetId: id,
        metadata: { number, total: columns.total },
        requestId,
      });
      return {
        quote: await this.getQuote(trx, tenant.organizationId, id),
        replayed: false,
      };
    });
  }

  private async lockQuote(
    trx: Transaction<Database>,
    organizationId: string,
    id: string,
  ) {
    if (!UUID_RE.test(id)) throw quoteNotFound();
    const row = await trx
      .selectFrom('app.quotes')
      .select(['id', 'status', 'number'])
      .select(sql<string>`issue_date::text`.as('issue_day'))
      .where('organization_id', '=', organizationId)
      .where('id', '=', id)
      .forUpdate()
      .executeTakeFirst();
    if (!row) throw quoteNotFound();
    return row;
  }

  async updateQuote(
    tenant: TenantContext,
    user: AuthContext,
    id: string,
    input: UpdateQuoteInput,
    requestId: string | null,
  ): Promise<QuoteDto> {
    return this.database.db.transaction().execute(async (trx) => {
      const quote = await this.lockQuote(trx, tenant.organizationId, id);
      if (quote.status !== 'draft')
        throw conflict(
          'QUOTE_NOT_DRAFT',
          'Seul un devis en brouillon se modifie.',
        );
      if (input.validUntil < quote.issue_day)
        throw invalid(
          'validUntil',
          'La date de validité précède la date du devis.',
        );
      await this.customer(trx, tenant.organizationId, input.customerId);
      await this.checkLines(trx, tenant.organizationId, input.lines);
      const { columns } = this.totalsColumns(input.lines, input.discount);
      await trx
        .updateTable('app.quotes')
        .set({
          customer_id: input.customerId,
          valid_until: input.validUntil,
          lines: JSON.stringify(input.lines),
          notes: input.notes,
          ...columns,
        })
        .where('organization_id', '=', tenant.organizationId)
        .where('id', '=', id)
        .execute();
      await this.audit.record(trx, {
        organizationId: tenant.organizationId,
        actorType: 'user',
        actorId: user.userId,
        action: 'quote.updated',
        targetType: 'quote',
        targetId: id,
        metadata: { total: columns.total },
        requestId,
      });
      return this.getQuote(trx, tenant.organizationId, id);
    });
  }

  async changeQuoteStatus(
    tenant: TenantContext,
    user: AuthContext,
    id: string,
    status: Exclude<QuoteStatus, 'draft'>,
    requestId: string | null,
  ): Promise<QuoteDto> {
    return this.database.db.transaction().execute(async (trx) => {
      const quote = await this.lockQuote(trx, tenant.organizationId, id);
      if (!canChangeQuoteStatus(quote.status, status))
        throw conflict(
          'INVALID_STATUS_TRANSITION',
          'Ce changement de statut n’est pas possible.',
        );
      await trx
        .updateTable('app.quotes')
        .set({ status })
        .where('organization_id', '=', tenant.organizationId)
        .where('id', '=', id)
        .execute();
      await this.audit.record(trx, {
        organizationId: tenant.organizationId,
        actorType: 'user',
        actorId: user.userId,
        action: 'quote.status_changed',
        targetType: 'quote',
        targetId: id,
        metadata: { from: quote.status, to: status },
        requestId,
      });
      return this.getQuote(trx, tenant.organizationId, id);
    });
  }

  /** An accepted quote becomes a draft invoice, once. */
  async invoiceFromQuote(
    tenant: TenantContext,
    user: AuthContext,
    id: string,
    clientOperationId: string,
    requestId: string | null,
  ): Promise<{ invoice: InvoiceDto; replayed: boolean }> {
    return this.inInvoiceTransaction(tenant, clientOperationId, async (trx) => {
      const quote = await this.lockQuote(trx, tenant.organizationId, id);
      if (quote.status !== 'accepted')
        throw conflict(
          'QUOTE_NOT_ACCEPTED',
          'Le devis doit d’abord être accepté par le client.',
        );
      const already = await trx
        .selectFrom('app.invoices')
        .select('id')
        .where('organization_id', '=', tenant.organizationId)
        .where('quote_id', '=', id)
        .where('kind', '=', 'invoice')
        .executeTakeFirst();
      if (already)
        throw conflict(
          'QUOTE_ALREADY_INVOICED',
          'Une facture a déjà été faite pour ce devis.',
        );
      const row = await trx
        .selectFrom('app.quotes')
        .select(['customer_id', 'lines', 'notes', 'discount'])
        .where('organization_id', '=', tenant.organizationId)
        .where('id', '=', id)
        .executeTakeFirstOrThrow();
      return this.insertDraft(trx, tenant, user, {
        customerId: row.customer_id,
        lines: row.lines,
        discount: toNumber(row.discount),
        notes: row.notes,
        dueDate: null,
        clientOperationId,
        quoteId: id,
        saleId: null,
        requestId,
        origin: { quote: quote.number },
      });
    });
  }

  // -------------------------------------------------------------------------
  // Invoices
  // -------------------------------------------------------------------------

  async getInvoice(
    executor: Executor,
    organizationId: string,
    id: string,
  ): Promise<InvoiceDto> {
    if (!UUID_RE.test(id)) throw invoiceNotFound();
    const row = await executor
      .selectFrom('app.invoices as i')
      .leftJoin('app.quotes as q', (join) =>
        join
          .onRef('q.organization_id', '=', 'i.organization_id')
          .onRef('q.id', '=', 'i.quote_id'),
      )
      .leftJoin('app.sales as s', (join) =>
        join
          .onRef('s.organization_id', '=', 'i.organization_id')
          .onRef('s.id', '=', 'i.sale_id'),
      )
      .leftJoin('app.invoices as f', (join) =>
        join
          .onRef('f.organization_id', '=', 'i.organization_id')
          .onRef('f.id', '=', 'i.credit_for_id'),
      )
      .leftJoin('app.invoices as a', (join) =>
        join
          .onRef('a.organization_id', '=', 'i.organization_id')
          .onRef('a.credit_for_id', '=', 'i.id'),
      )
      .selectAll('i')
      .select([
        'q.number as quote_number',
        's.sale_number',
        'f.number as credit_for_number',
        'a.id as credit_note_id',
        'a.number as credit_note_number',
      ])
      .select(sql<string | null>`i.issue_date::text`.as('issue_day'))
      .select(sql<string | null>`i.due_date::text`.as('due_day'))
      .where('i.organization_id', '=', organizationId)
      .where('i.id', '=', id)
      .executeTakeFirst();
    if (!row) throw invoiceNotFound();
    const [customer, payments, shop] = await Promise.all([
      this.customer(executor, organizationId, row.customer_id),
      executor
        .selectFrom('app.invoice_payments')
        .selectAll()
        .select(sql<string>`paid_on::text`.as('paid_day'))
        .where('organization_id', '=', organizationId)
        .where('invoice_id', '=', id)
        .orderBy('created_at')
        .execute(),
      this.shop(executor, organizationId),
    ]);
    const { lines, totals } = this.withLineTotals(
      row.lines,
      toNumber(row.discount),
    );
    const paid = payments.reduce((sum, p) => sum + toNumber(p.amount), 0);
    const isInvoice = row.kind === 'invoice' && row.status === 'issued';
    const balance = isInvoice ? Math.max(totals.total - paid, 0) : 0;
    return {
      id: row.id,
      kind: row.kind,
      number: row.number,
      status: row.status,
      paymentState: paymentState(totals.total, paid),
      issueDate: row.issue_day,
      dueDate: row.due_day,
      overdue:
        isInvoice &&
        balance > 0 &&
        row.due_day !== null &&
        row.due_day < today(shop.timezone),
      customer,
      lines,
      notes: row.notes,
      totals,
      paid,
      balance,
      payments: payments.map((p) => ({
        id: p.id,
        method: p.method,
        provider: p.provider,
        reference: p.reference,
        amount: toNumber(p.amount),
        paidOn: p.paid_day,
        fromSale: p.from_sale,
      })),
      quote:
        row.quote_id && row.quote_number
          ? { id: row.quote_id, number: row.quote_number }
          : null,
      sale:
        row.sale_id && row.sale_number
          ? { id: row.sale_id, saleNumber: row.sale_number }
          : null,
      creditFor: row.credit_for_id
        ? { id: row.credit_for_id, number: row.credit_for_number }
        : null,
      creditNote: row.credit_note_id
        ? { id: row.credit_note_id, number: row.credit_note_number }
        : null,
      cancellation:
        row.cancelled_at && row.cancel_reason
          ? { at: row.cancelled_at.toISOString(), reason: row.cancel_reason }
          : null,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  async listInvoices(organizationId: string): Promise<DocumentListItemDto[]> {
    const { timezone } = await this.shop(this.database.db, organizationId);
    const day = today(timezone);
    const rows = await this.database.db
      .selectFrom('app.invoices as i')
      .innerJoin('app.customers as c', (join) =>
        join
          .onRef('c.organization_id', '=', 'i.organization_id')
          .onRef('c.id', '=', 'i.customer_id'),
      )
      .select([
        'i.id',
        'i.kind',
        'i.number',
        'i.status',
        'i.total',
        'i.created_at',
        'c.name as customer_name',
      ])
      .select(sql<string | null>`i.issue_date::text`.as('issue_day'))
      .select(sql<string | null>`i.due_date::text`.as('due_day'))
      .select(
        sql<string>`coalesce((select sum(p.amount) from app.invoice_payments p where p.organization_id = i.organization_id and p.invoice_id = i.id), 0)`.as(
          'paid',
        ),
      )
      .where('i.organization_id', '=', organizationId)
      .orderBy('i.created_at', 'desc')
      .limit(200)
      .execute();
    return rows.map((row) => {
      const total = toNumber(row.total);
      const paid = toNumber(row.paid);
      const open = row.kind === 'invoice' && row.status === 'issued';
      const balance = open ? Math.max(total - paid, 0) : null;
      return {
        id: row.id,
        kind: row.kind,
        number: row.number,
        customerName: row.customer_name,
        status: row.status,
        paymentState: row.kind === 'invoice' ? paymentState(total, paid) : null,
        expired: false,
        overdue:
          open &&
          (balance ?? 0) > 0 &&
          row.due_day !== null &&
          row.due_day < day,
        total,
        balance,
        date: row.issue_day ?? row.created_at.toISOString().slice(0, 10),
      };
    });
  }

  /** Idempotent creation of a draft: a replay answers the same invoice. */
  private async inInvoiceTransaction(
    tenant: TenantContext,
    clientOperationId: string,
    work: (
      trx: Transaction<Database>,
    ) => Promise<{ invoice: InvoiceDto; replayed: boolean }>,
  ): Promise<{ invoice: InvoiceDto; replayed: boolean }> {
    try {
      return await this.database.db.transaction().execute(async (trx) => {
        const previous = await trx
          .selectFrom('app.invoices')
          .select('id')
          .where('organization_id', '=', tenant.organizationId)
          .where('client_operation_id', '=', clientOperationId)
          .executeTakeFirst();
        if (previous)
          return {
            invoice: await this.getInvoice(
              trx,
              tenant.organizationId,
              previous.id,
            ),
            replayed: true,
          };
        return work(trx);
      });
    } catch (error) {
      if (pgErrorCode(error) === UNIQUE_VIOLATION) {
        const previous = await this.database.db
          .selectFrom('app.invoices')
          .select('id')
          .where('organization_id', '=', tenant.organizationId)
          .where('client_operation_id', '=', clientOperationId)
          .executeTakeFirst();
        if (previous)
          return {
            invoice: await this.getInvoice(
              this.database.db,
              tenant.organizationId,
              previous.id,
            ),
            replayed: true,
          };
      }
      throw error;
    }
  }

  private async insertDraft(
    trx: Transaction<Database>,
    tenant: TenantContext,
    user: AuthContext,
    draft: {
      customerId: string;
      lines: DocumentLine[];
      discount: number;
      notes: string;
      dueDate: string | null;
      clientOperationId: string;
      quoteId: string | null;
      saleId: string | null;
      requestId: string | null;
      origin?: Record<string, unknown>;
    },
  ): Promise<{ invoice: InvoiceDto; replayed: boolean }> {
    await this.customer(trx, tenant.organizationId, draft.customerId);
    await this.checkLines(trx, tenant.organizationId, draft.lines);
    const { columns } = this.totalsColumns(draft.lines, draft.discount);
    const { id } = await trx
      .insertInto('app.invoices')
      .values({
        organization_id: tenant.organizationId,
        customer_id: draft.customerId,
        quote_id: draft.quoteId,
        sale_id: draft.saleId,
        due_date: draft.dueDate,
        lines: JSON.stringify(draft.lines),
        notes: draft.notes,
        ...columns,
        client_operation_id: draft.clientOperationId,
        created_by: user.userId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await this.audit.record(trx, {
      organizationId: tenant.organizationId,
      actorType: 'user',
      actorId: user.userId,
      action: 'invoice.drafted',
      targetType: 'invoice',
      targetId: id,
      metadata: { total: columns.total, ...draft.origin },
      requestId: draft.requestId,
    });
    return {
      invoice: await this.getInvoice(trx, tenant.organizationId, id),
      replayed: false,
    };
  }

  createInvoice(
    tenant: TenantContext,
    user: AuthContext,
    input: CreateInvoiceInput,
    requestId: string | null,
  ) {
    return this.inInvoiceTransaction(tenant, input.clientOperationId, (trx) =>
      this.insertDraft(trx, tenant, user, {
        ...input,
        quoteId: null,
        saleId: null,
        requestId,
      }),
    );
  }

  /** A sale paid at the counter becomes a settled invoice (« acquittée »). */
  invoiceFromSale(
    tenant: TenantContext,
    user: AuthContext,
    saleId: string,
    input: { customerId: string | null; clientOperationId: string },
    requestId: string | null,
  ) {
    return this.inInvoiceTransaction(
      tenant,
      input.clientOperationId,
      async (trx) => {
        const sale = UUID_RE.test(saleId)
          ? await trx
              .selectFrom('app.sales')
              .select([
                'id',
                'status',
                'sale_number',
                'customer_id',
                'discount',
              ])
              .where('organization_id', '=', tenant.organizationId)
              .where('id', '=', saleId)
              .forUpdate()
              .executeTakeFirst()
          : undefined;
        if (!sale) throw notFound('SALE_NOT_FOUND', 'Vente introuvable.');
        if (sale.status !== 'completed')
          throw conflict('SALE_CANCELLED', 'Cette vente est annulée.');
        const credit = await trx
          .selectFrom('app.sale_payments')
          .select('id')
          .where('organization_id', '=', tenant.organizationId)
          .where('sale_id', '=', saleId)
          .where('method', '=', 'credit')
          .executeTakeFirst();
        if (credit)
          throw conflict(
            'SALE_ON_CREDIT',
            'Une vente à crédit se facture une fois le client a tout payé : faites plutôt une facture à part.',
          );
        const already = await trx
          .selectFrom('app.invoices')
          .select('id')
          .where('organization_id', '=', tenant.organizationId)
          .where('sale_id', '=', saleId)
          .where('kind', '=', 'invoice')
          .where('status', '<>', 'cancelled')
          .executeTakeFirst();
        if (already)
          throw conflict(
            'SALE_ALREADY_INVOICED',
            'Cette vente a déjà une facture.',
          );
        const customerId = sale.customer_id ?? input.customerId;
        if (!customerId)
          throw invalid(
            'customerId',
            'Choisissez le client à qui faire la facture.',
          );
        const lines = await trx
          .selectFrom('app.sale_lines')
          .select([
            'product_id',
            'label',
            'unit',
            'unit_price',
            'quantity',
            'tax_rate_basis_points',
          ])
          .where('organization_id', '=', tenant.organizationId)
          .where('sale_id', '=', saleId)
          .orderBy('position')
          .execute();
        return this.insertDraft(trx, tenant, user, {
          customerId,
          lines: lines.map((line) => ({
            productId: line.product_id,
            label: line.label,
            unit: line.unit,
            quantity: toNumber(line.quantity),
            unitPrice: toNumber(line.unit_price),
            taxRateBasisPoints: line.tax_rate_basis_points,
          })),
          discount: toNumber(sale.discount),
          notes: `Vente n° ${String(sale.sale_number).padStart(6, '0')} réglée en caisse.`,
          dueDate: null,
          clientOperationId: input.clientOperationId,
          quoteId: null,
          saleId,
          requestId,
          origin: { saleNumber: sale.sale_number },
        });
      },
    );
  }

  private async lockInvoice(
    trx: Transaction<Database>,
    organizationId: string,
    id: string,
  ) {
    if (!UUID_RE.test(id)) throw invoiceNotFound();
    const row = await trx
      .selectFrom('app.invoices')
      .select([
        'id',
        'kind',
        'status',
        'number',
        'sale_id',
        'total',
        'due_date',
      ])
      .where('organization_id', '=', organizationId)
      .where('id', '=', id)
      .forUpdate()
      .executeTakeFirst();
    if (!row) throw invoiceNotFound();
    return row;
  }

  async updateInvoice(
    tenant: TenantContext,
    user: AuthContext,
    id: string,
    input: UpdateInvoiceInput,
    requestId: string | null,
  ): Promise<InvoiceDto> {
    return this.database.db.transaction().execute(async (trx) => {
      const invoice = await this.lockInvoice(trx, tenant.organizationId, id);
      if (invoice.status !== 'draft')
        throw conflict(
          'INVOICE_ISSUED',
          'Une facture émise ne se modifie plus : faites un avoir.',
        );
      await this.customer(trx, tenant.organizationId, input.customerId);
      await this.checkLines(trx, tenant.organizationId, input.lines);
      const { columns } = this.totalsColumns(input.lines, input.discount);
      await trx
        .updateTable('app.invoices')
        .set({
          customer_id: input.customerId,
          due_date: input.dueDate,
          lines: JSON.stringify(input.lines),
          notes: input.notes,
          ...columns,
        })
        .where('organization_id', '=', tenant.organizationId)
        .where('id', '=', id)
        .execute();
      await this.audit.record(trx, {
        organizationId: tenant.organizationId,
        actorType: 'user',
        actorId: user.userId,
        action: 'invoice.updated',
        targetType: 'invoice',
        targetId: id,
        metadata: { total: columns.total },
        requestId,
      });
      return this.getInvoice(trx, tenant.organizationId, id);
    });
  }

  /** Gives the legal number: from then on, the invoice never changes. */
  async issueInvoice(
    tenant: TenantContext,
    user: AuthContext,
    id: string,
    requestId: string | null,
  ): Promise<InvoiceDto> {
    return this.database.db.transaction().execute(async (trx) => {
      const invoice = await this.lockInvoice(trx, tenant.organizationId, id);
      if (invoice.status !== 'draft')
        throw conflict('INVOICE_ISSUED', 'Cette facture est déjà émise.');
      if (invoice.sale_id) {
        // The sale may have been cancelled since the draft was made.
        const sale = await trx
          .selectFrom('app.sales')
          .select('status')
          .where('organization_id', '=', tenant.organizationId)
          .where('id', '=', invoice.sale_id)
          .executeTakeFirstOrThrow();
        if (sale.status !== 'completed')
          throw conflict('SALE_CANCELLED', 'Cette vente est annulée.');
      }
      const shop = await this.shop(trx, tenant.organizationId);
      const day = today(shop.timezone);
      const number = await this.nextNumber(
        trx,
        tenant.organizationId,
        'invoice',
        day,
      );
      const due = await trx
        .selectFrom('app.invoices')
        .select(sql<string | null>`due_date::text`.as('due_day'))
        .where('organization_id', '=', tenant.organizationId)
        .where('id', '=', id)
        .executeTakeFirstOrThrow();
      const dueDate =
        due.due_day && due.due_day >= day
          ? due.due_day
          : addDays(day, shop.invoice_due_days);
      await trx
        .updateTable('app.invoices')
        .set({
          status: 'issued',
          number,
          issue_date: day,
          due_date: dueDate,
          issued_at: new Date(),
          issued_by: user.userId,
        })
        .where('organization_id', '=', tenant.organizationId)
        .where('id', '=', id)
        .execute();
      // Made from a sale paid at the counter: already settled.
      if (invoice.sale_id) {
        const paid = await trx
          .selectFrom('app.sale_payments')
          .select(['method', 'provider', 'reference', 'amount'])
          .where('organization_id', '=', tenant.organizationId)
          .where('sale_id', '=', invoice.sale_id)
          .where('method', '<>', 'credit')
          .execute();
        for (const payment of paid)
          await trx
            .insertInto('app.invoice_payments')
            .values({
              organization_id: tenant.organizationId,
              invoice_id: id,
              method: payment.method as Exclude<
                typeof payment.method,
                'credit'
              >,
              provider: payment.provider,
              reference: payment.reference,
              amount: toNumber(payment.amount),
              paid_on: day,
              from_sale: true,
              client_operation_id: crypto.randomUUID(),
              created_by: user.userId,
            })
            .execute();
      }
      await this.audit.record(trx, {
        organizationId: tenant.organizationId,
        actorType: 'user',
        actorId: user.userId,
        action: 'invoice.issued',
        targetType: 'invoice',
        targetId: id,
        metadata: { number, total: toNumber(invoice.total) },
        requestId,
      });
      return this.getInvoice(trx, tenant.organizationId, id);
    });
  }

  async addPayment(
    tenant: TenantContext,
    user: AuthContext,
    id: string,
    input: InvoicePaymentInput,
    requestId: string | null,
  ): Promise<{ invoice: InvoiceDto; replayed: boolean }> {
    try {
      return await this.database.db.transaction().execute(async (trx) => {
        const invoice = await this.lockInvoice(trx, tenant.organizationId, id);
        const previous = await trx
          .selectFrom('app.invoice_payments')
          .select('invoice_id')
          .where('organization_id', '=', tenant.organizationId)
          .where('client_operation_id', '=', input.clientOperationId)
          .executeTakeFirst();
        if (previous) {
          if (previous.invoice_id !== id)
            throw conflict(
              'OPERATION_ID_REUSED',
              'Cet identifiant d’opération a déjà servi.',
            );
          return {
            invoice: await this.getInvoice(trx, tenant.organizationId, id),
            replayed: true,
          };
        }
        if (invoice.kind !== 'invoice' || invoice.status !== 'issued')
          throw conflict(
            'INVOICE_NOT_PAYABLE',
            'Seule une facture émise et non annulée se paie.',
          );
        const current = await this.getInvoice(trx, tenant.organizationId, id);
        if (input.amount > current.balance)
          throw new ApiException(
            HttpStatus.CONFLICT,
            'PAYMENT_TOO_HIGH',
            current.balance > 0
              ? 'Ce montant dépasse le reste à payer.'
              : 'Cette facture est déjà payée.',
          );
        await trx
          .insertInto('app.invoice_payments')
          .values({
            organization_id: tenant.organizationId,
            invoice_id: id,
            method: input.method,
            provider: input.provider,
            reference: input.reference,
            amount: input.amount,
            paid_on: input.paidOn,
            client_operation_id: input.clientOperationId,
            created_by: user.userId,
          })
          .execute();
        await this.audit.record(trx, {
          organizationId: tenant.organizationId,
          actorType: 'user',
          actorId: user.userId,
          action: 'invoice.paid',
          targetType: 'invoice',
          targetId: id,
          metadata: {
            amount: input.amount,
            method: input.method,
            balanceBefore: current.balance,
          },
          requestId,
        });
        return {
          invoice: await this.getInvoice(trx, tenant.organizationId, id),
          replayed: false,
        };
      });
    } catch (error) {
      if (pgErrorCode(error) === UNIQUE_VIOLATION)
        return {
          invoice: await this.getInvoice(
            this.database.db,
            tenant.organizationId,
            id,
          ),
          replayed: true,
        };
      throw error;
    }
  }

  /** Cancels an issued invoice by a credit note of the same amount. */
  async cancelInvoice(
    tenant: TenantContext,
    user: AuthContext,
    id: string,
    input: CancelInvoiceInput,
    requestId: string | null,
  ): Promise<InvoiceDto> {
    return this.database.db.transaction().execute(async (trx) => {
      const invoice = await this.lockInvoice(trx, tenant.organizationId, id);
      if (invoice.kind !== 'invoice' || invoice.status !== 'issued')
        throw conflict(
          'INVOICE_NOT_CANCELLABLE',
          'Seule une facture émise et non annulée s’annule.',
        );
      const received = await trx
        .selectFrom('app.invoice_payments')
        .select('id')
        .where('organization_id', '=', tenant.organizationId)
        .where('invoice_id', '=', id)
        .where('from_sale', '=', false)
        .executeTakeFirst();
      if (received)
        throw conflict(
          'INVOICE_HAS_PAYMENTS',
          'Cette facture a déjà reçu des paiements : remboursez le client avant de l’annuler.',
        );
      const full = await trx
        .selectFrom('app.invoices')
        .select([
          'customer_id',
          'lines',
          'notes',
          'subtotal',
          'discount',
          'total',
          'tax_total',
        ])
        .where('organization_id', '=', tenant.organizationId)
        .where('id', '=', id)
        .executeTakeFirstOrThrow();
      const shop = await this.shop(trx, tenant.organizationId);
      const day = today(shop.timezone);
      const number = await this.nextNumber(
        trx,
        tenant.organizationId,
        'credit_note',
        day,
      );
      const { id: creditNoteId } = await trx
        .insertInto('app.invoices')
        .values({
          organization_id: tenant.organizationId,
          kind: 'credit_note',
          number,
          status: 'issued',
          customer_id: full.customer_id,
          credit_for_id: id,
          issue_date: day,
          lines: JSON.stringify(full.lines),
          notes: `Avoir annulant la facture ${invoice.number} : ${input.reason}`,
          subtotal: full.subtotal,
          discount: full.discount,
          total: full.total,
          tax_total: full.tax_total,
          issued_at: new Date(),
          issued_by: user.userId,
          client_operation_id: input.clientOperationId,
          created_by: user.userId,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await trx
        .updateTable('app.invoices')
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
        action: 'invoice.cancelled',
        targetType: 'invoice',
        targetId: id,
        metadata: {
          number: invoice.number,
          creditNote: number,
          creditNoteId,
          reason: input.reason,
        },
        requestId,
      });
      return this.getInvoice(trx, tenant.organizationId, id);
    });
  }
}
