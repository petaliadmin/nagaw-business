// Quotes and invoices part of the fake API (see fake-backend.mjs). Same
// shared schemas and rules as the real API (ADR-026): numbers given by the
// server (quotes at creation, invoices at issue), issued invoices final,
// payments up to the balance, cancellation by a credit note.
import { randomUUID } from 'node:crypto';
import {
  cancelInvoiceSchema,
  canChangeQuoteStatus,
  changeQuoteStatusSchema,
  computeDocumentTotals,
  createInvoiceSchema,
  createQuoteSchema,
  formatDocumentNumber,
  fromSaleSchema,
  fromSourceSchema,
  invoicePaymentSchema,
  updateInvoiceSchema,
  updateQuoteSchema,
} from '@nagaw/shared';
import { salesState } from './fake-sales.mjs';

function seed() {
  return { sequences: {}, quotes: [], invoices: [] };
}
let state = seed();
export function resetDocuments() {
  state = seed();
}
export const documentsState = () => state;

const today = (timeZone) =>
  new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
function addDays(day, n) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}
function nextNumber(orgId, kind, day) {
  const year = Number(day.slice(0, 4));
  const key = `${orgId}:${kind}:${year}`;
  const n = (state.sequences[key] ?? 0) + 1;
  state.sequences[key] = n;
  return formatDocumentNumber(kind, year, n);
}

// A one-page PDF, enough for the browser to recognize it.
const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
);

/** Handles document routes; returns false for other paths. */
export async function handleDocuments(ctx) {
  const { req, res, path, orgId, role, organization, send, apiError } = ctx;
  if (!/^\/api\/v1\/(quotes|invoices|documents)(\/|$)/.test(path)) return false;
  const reply = (status, body) => {
    send(res, status, body);
    return true;
  };
  const fail = (status, code, message) => {
    apiError(res, status, code, message);
    return true;
  };
  const invalid = (issues) =>
    reply(400, {
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Données invalides.',
        details: issues.map((i) => ({
          path: Array.isArray(i.path) ? i.path.join('.') : i.path,
          message: i.message,
        })),
      },
    });
  const manager = role === 'owner' || role === 'admin';
  if (!manager && role !== 'viewer') {
    ctx.forbidden(res);
    return true;
  }
  const write = req.method !== 'GET';
  if (write && !manager) {
    ctx.forbidden(res);
    return true;
  }
  const mine = (item) => item.organizationId === orgId;
  const day = today(organization.timezone);
  const sales = salesState();
  const customerOf = (id) =>
    sales.customers.find((c) => c.id === id && mine(c));
  const customerDto = (id) => {
    const c = customerOf(id);
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email ?? '',
      address: c.address ?? '',
      taxId: c.taxId ?? '',
    };
  };
  const body = write ? await ctx.readJson(req) : null;
  const checkDocument = (data) => {
    if (!customerOf(data.customerId))
      return [{ path: 'customerId', message: 'Client inconnu.' }];
    const totals = computeDocumentTotals(data.lines, data.discount);
    if (data.discount > totals.subtotal)
      return [
        {
          path: 'discount',
          message: 'La remise dépasse le montant du document.',
        },
      ];
    return null;
  };
  const withTotals = (doc) => {
    const totals = computeDocumentTotals(doc.lines, doc.discount);
    return {
      totals,
      lines: doc.lines.map((l, i) => ({
        ...l,
        lineTotal: totals.lineTotals[i],
      })),
    };
  };
  const quoteDto = (q) => {
    const invoice = state.invoices.find(
      (i) => i.quoteId === q.id && i.kind === 'invoice',
    );
    return {
      id: q.id,
      number: q.number,
      status: q.status,
      expired:
        (q.status === 'draft' || q.status === 'sent') && q.validUntil < day,
      issueDate: q.issueDate,
      validUntil: q.validUntil,
      customer: customerDto(q.customerId),
      ...withTotals(q),
      notes: q.notes,
      invoice: invoice ? { id: invoice.id, number: invoice.number } : null,
      createdAt: q.createdAt,
      updatedAt: q.updatedAt,
    };
  };
  const invoiceDto = (i) => {
    const { totals, lines } = withTotals(i);
    const paid = i.payments.reduce((sum, p) => sum + p.amount, 0);
    const open = i.kind === 'invoice' && i.status === 'issued';
    const balance = open ? Math.max(totals.total - paid, 0) : 0;
    const quote = state.quotes.find((q) => q.id === i.quoteId);
    const sale = sales.sales.find((s) => s.id === i.saleId);
    const creditFor = state.invoices.find((x) => x.id === i.creditForId);
    const creditNote = state.invoices.find((x) => x.creditForId === i.id);
    return {
      id: i.id,
      kind: i.kind,
      number: i.number,
      status: i.status,
      paymentState:
        paid <= 0 ? 'unpaid' : paid >= totals.total ? 'paid' : 'partially_paid',
      issueDate: i.issueDate,
      dueDate: i.dueDate,
      overdue: open && balance > 0 && i.dueDate !== null && i.dueDate < day,
      customer: customerDto(i.customerId),
      lines,
      notes: i.notes,
      totals,
      paid,
      balance,
      payments: i.payments,
      quote: quote ? { id: quote.id, number: quote.number } : null,
      sale: sale ? { id: sale.id, saleNumber: sale.saleNumber } : null,
      creditFor: creditFor
        ? { id: creditFor.id, number: creditFor.number }
        : null,
      creditNote: creditNote
        ? { id: creditNote.id, number: creditNote.number }
        : null,
      cancellation: i.cancellation,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
    };
  };
  const listItem = (dto, kind) => ({
    id: dto.id,
    kind,
    number: dto.number,
    customerName: dto.customer.name,
    status: dto.status,
    paymentState: kind === 'invoice' ? dto.paymentState : null,
    expired: kind === 'quote' ? dto.expired : false,
    overdue: kind === 'quote' ? false : dto.overdue,
    total: dto.totals.total,
    balance: kind === 'invoice' && dto.status === 'issued' ? dto.balance : null,
    date: dto.issueDate ?? dto.createdAt.slice(0, 10),
  });
  const draft = (data, links) => {
    const now = new Date().toISOString();
    const invoice = {
      id: randomUUID(),
      organizationId: orgId,
      kind: 'invoice',
      number: null,
      status: 'draft',
      customerId: data.customerId,
      quoteId: links.quoteId ?? null,
      saleId: links.saleId ?? null,
      creditForId: null,
      issueDate: null,
      dueDate: data.dueDate ?? null,
      lines: data.lines,
      discount: data.discount,
      notes: data.notes,
      payments: [],
      cancellation: null,
      clientOperationId: data.clientOperationId,
      createdAt: now,
      updatedAt: now,
    };
    state.invoices.push(invoice);
    return reply(201, invoiceDto(invoice));
  };
  const replayed = (clientOperationId) =>
    state.invoices.find(
      (i) => mine(i) && i.clientOperationId === clientOperationId,
    );

  if (path === '/api/v1/documents/shop' && req.method === 'GET')
    return reply(200, {
      name: organization.name,
      legalName: organization.legalName,
      address: organization.address,
      phone: organization.phone,
      email: organization.email,
      taxId: organization.taxId,
      tradeRegister: organization.tradeRegister,
      invoiceFooter: organization.invoiceFooter,
      invoiceDueDays: organization.invoiceDueDays,
      quoteValidityDays: organization.quoteValidityDays,
    });

  // Quotes ------------------------------------------------------------------
  if (path === '/api/v1/quotes' && req.method === 'GET')
    return reply(
      200,
      state.quotes
        .filter(mine)
        .reverse()
        .map((q) => listItem(quoteDto(q), 'quote')),
    );
  if (path === '/api/v1/quotes' && req.method === 'POST') {
    const parsed = createQuoteSchema.safeParse(body);
    if (!parsed.success) return invalid(parsed.error.issues);
    const data = parsed.data;
    const replay = state.quotes.find(
      (q) => mine(q) && q.clientOperationId === data.clientOperationId,
    );
    if (replay) return reply(200, quoteDto(replay));
    const problem = checkDocument(data);
    if (problem) return invalid(problem);
    const validUntil =
      data.validUntil ?? addDays(day, organization.quoteValidityDays);
    if (validUntil < day)
      return invalid([
        { path: 'validUntil', message: 'La date de validité est passée.' },
      ]);
    const now = new Date().toISOString();
    const quote = {
      id: randomUUID(),
      organizationId: orgId,
      number: nextNumber(orgId, 'quote', day),
      status: 'draft',
      customerId: data.customerId,
      issueDate: day,
      validUntil,
      lines: data.lines,
      discount: data.discount,
      notes: data.notes,
      clientOperationId: data.clientOperationId,
      createdAt: now,
      updatedAt: now,
    };
    state.quotes.push(quote);
    return reply(201, quoteDto(quote));
  }
  const quoteMatch =
    /^\/api\/v1\/quotes\/([^/]+)(\/status|\/invoice|\/pdf)?$/.exec(path);
  if (quoteMatch) {
    const quote = state.quotes.find((q) => q.id === quoteMatch[1] && mine(q));
    if (!quote) return fail(404, 'QUOTE_NOT_FOUND', 'Devis introuvable.');
    const action = quoteMatch[2];
    if (!action && req.method === 'GET') return reply(200, quoteDto(quote));
    if (action === '/pdf' && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'application/pdf' });
      res.end(PDF);
      return true;
    }
    if (!action && req.method === 'PUT') {
      const parsed = updateQuoteSchema.safeParse(body);
      if (!parsed.success) return invalid(parsed.error.issues);
      if (quote.status !== 'draft')
        return fail(
          409,
          'QUOTE_NOT_DRAFT',
          'Seul un devis en brouillon se modifie.',
        );
      const problem = checkDocument(parsed.data);
      if (problem) return invalid(problem);
      Object.assign(quote, parsed.data, {
        updatedAt: new Date().toISOString(),
      });
      return reply(200, quoteDto(quote));
    }
    if (action === '/status' && req.method === 'POST') {
      const parsed = changeQuoteStatusSchema.safeParse(body);
      if (!parsed.success) return invalid(parsed.error.issues);
      if (!canChangeQuoteStatus(quote.status, parsed.data.status))
        return fail(
          409,
          'INVALID_STATUS_TRANSITION',
          'Ce changement de statut n’est pas possible.',
        );
      quote.status = parsed.data.status;
      return reply(200, quoteDto(quote));
    }
    if (action === '/invoice' && req.method === 'POST') {
      const parsed = fromSourceSchema.safeParse(body);
      if (!parsed.success) return invalid(parsed.error.issues);
      const replay = replayed(parsed.data.clientOperationId);
      if (replay) return reply(200, invoiceDto(replay));
      if (quote.status !== 'accepted')
        return fail(
          409,
          'QUOTE_NOT_ACCEPTED',
          'Le devis doit d’abord être accepté par le client.',
        );
      if (state.invoices.some((i) => i.quoteId === quote.id))
        return fail(
          409,
          'QUOTE_ALREADY_INVOICED',
          'Une facture a déjà été faite pour ce devis.',
        );
      return draft(
        {
          ...quote,
          dueDate: null,
          clientOperationId: parsed.data.clientOperationId,
        },
        { quoteId: quote.id },
      );
    }
  }

  // Invoices ----------------------------------------------------------------
  if (path === '/api/v1/invoices' && req.method === 'GET')
    return reply(
      200,
      state.invoices
        .filter(mine)
        .reverse()
        .map((i) => listItem(invoiceDto(i), i.kind)),
    );
  if (path === '/api/v1/invoices' && req.method === 'POST') {
    const parsed = createInvoiceSchema.safeParse(body);
    if (!parsed.success) return invalid(parsed.error.issues);
    const replay = replayed(parsed.data.clientOperationId);
    if (replay) return reply(200, invoiceDto(replay));
    const problem = checkDocument(parsed.data);
    if (problem) return invalid(problem);
    return draft(parsed.data, {});
  }
  const fromSale = /^\/api\/v1\/invoices\/from-sale\/([^/]+)$/.exec(path);
  if (fromSale && req.method === 'POST') {
    const parsed = fromSaleSchema.safeParse(body);
    if (!parsed.success) return invalid(parsed.error.issues);
    const replay = replayed(parsed.data.clientOperationId);
    if (replay) return reply(200, invoiceDto(replay));
    const sale = sales.sales.find((s) => s.id === fromSale[1] && mine(s));
    if (!sale) return fail(404, 'SALE_NOT_FOUND', 'Vente introuvable.');
    if (sale.status !== 'completed')
      return fail(409, 'SALE_CANCELLED', 'Cette vente est annulée.');
    if (sale.payments.some((p) => p.method === 'credit'))
      return fail(
        409,
        'SALE_ON_CREDIT',
        'Une vente à crédit se facture une fois le client a tout payé : faites plutôt une facture à part.',
      );
    if (
      state.invoices.some(
        (i) => i.saleId === sale.id && i.status !== 'cancelled',
      )
    )
      return fail(
        409,
        'SALE_ALREADY_INVOICED',
        'Cette vente a déjà une facture.',
      );
    const customerId = sale.customerId ?? parsed.data.customerId;
    if (!customerId || !customerOf(customerId))
      return invalid([
        {
          path: 'customerId',
          message: 'Choisissez le client à qui faire la facture.',
        },
      ]);
    return draft(
      {
        customerId,
        lines: sale.lines.map((l) => ({
          productId: l.productId,
          label: l.label,
          unit: l.unit,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          taxRateBasisPoints: l.taxRateBasisPoints,
        })),
        discount: sale.discount,
        notes: `Vente n° ${String(sale.saleNumber).padStart(6, '0')} réglée en caisse.`,
        dueDate: null,
        clientOperationId: parsed.data.clientOperationId,
      },
      { saleId: sale.id },
    );
  }
  const invoiceMatch =
    /^\/api\/v1\/invoices\/([^/]+)(\/issue|\/payments|\/cancel|\/pdf)?$/.exec(
      path,
    );
  if (invoiceMatch) {
    const invoice = state.invoices.find(
      (i) => i.id === invoiceMatch[1] && mine(i),
    );
    if (!invoice) return fail(404, 'INVOICE_NOT_FOUND', 'Facture introuvable.');
    const action = invoiceMatch[2];
    if (!action && req.method === 'GET') return reply(200, invoiceDto(invoice));
    if (action === '/pdf' && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'application/pdf' });
      res.end(PDF);
      return true;
    }
    if (!action && req.method === 'PUT') {
      const parsed = updateInvoiceSchema.safeParse(body);
      if (!parsed.success) return invalid(parsed.error.issues);
      if (invoice.status !== 'draft')
        return fail(
          409,
          'INVOICE_ISSUED',
          'Une facture émise ne se modifie plus : faites un avoir.',
        );
      const problem = checkDocument(parsed.data);
      if (problem) return invalid(problem);
      Object.assign(invoice, parsed.data, {
        updatedAt: new Date().toISOString(),
      });
      return reply(200, invoiceDto(invoice));
    }
    if (action === '/issue' && req.method === 'POST') {
      if (invoice.status !== 'draft')
        return fail(409, 'INVOICE_ISSUED', 'Cette facture est déjà émise.');
      invoice.status = 'issued';
      invoice.number = nextNumber(orgId, 'invoice', day);
      invoice.issueDate = day;
      invoice.dueDate =
        invoice.dueDate && invoice.dueDate >= day
          ? invoice.dueDate
          : addDays(day, organization.invoiceDueDays);
      if (invoice.saleId) {
        const sale = sales.sales.find((s) => s.id === invoice.saleId);
        invoice.payments = sale.payments.map((p) => ({
          id: randomUUID(),
          method: p.method,
          provider: p.provider ?? null,
          reference: p.reference ?? null,
          amount: p.amount,
          paidOn: day,
          fromSale: true,
        }));
      }
      return reply(200, invoiceDto(invoice));
    }
    if (action === '/payments' && req.method === 'POST') {
      const parsed = invoicePaymentSchema.safeParse(body);
      if (!parsed.success) return invalid(parsed.error.issues);
      if (
        invoice.payments.some(
          (p) => p.clientOperationId === parsed.data.clientOperationId,
        )
      )
        return reply(200, invoiceDto(invoice));
      if (invoice.kind !== 'invoice' || invoice.status !== 'issued')
        return fail(
          409,
          'INVOICE_NOT_PAYABLE',
          'Seule une facture émise et non annulée se paie.',
        );
      const current = invoiceDto(invoice);
      if (parsed.data.amount > current.balance)
        return fail(
          409,
          'PAYMENT_TOO_HIGH',
          'Ce montant dépasse le reste à payer.',
        );
      invoice.payments.push({
        id: randomUUID(),
        method: parsed.data.method,
        provider: parsed.data.provider,
        reference: parsed.data.reference,
        amount: parsed.data.amount,
        paidOn: parsed.data.paidOn,
        fromSale: false,
        clientOperationId: parsed.data.clientOperationId,
      });
      return reply(201, invoiceDto(invoice));
    }
    if (action === '/cancel' && req.method === 'POST') {
      const parsed = cancelInvoiceSchema.safeParse(body);
      if (!parsed.success) return invalid(parsed.error.issues);
      if (invoice.kind !== 'invoice' || invoice.status !== 'issued')
        return fail(
          409,
          'INVOICE_NOT_CANCELLABLE',
          'Seule une facture émise et non annulée s’annule.',
        );
      if (invoice.payments.some((p) => !p.fromSale))
        return fail(
          409,
          'INVOICE_HAS_PAYMENTS',
          'Cette facture a déjà reçu des paiements : remboursez le client avant de l’annuler.',
        );
      const now = new Date().toISOString();
      state.invoices.push({
        ...invoice,
        id: randomUUID(),
        kind: 'credit_note',
        number: nextNumber(orgId, 'credit_note', day),
        status: 'issued',
        quoteId: null,
        saleId: null,
        creditForId: invoice.id,
        issueDate: day,
        dueDate: null,
        notes: `Avoir annulant la facture ${invoice.number} : ${parsed.data.reason}`,
        payments: [],
        cancellation: null,
        clientOperationId: parsed.data.clientOperationId,
        createdAt: now,
        updatedAt: now,
      });
      invoice.status = 'cancelled';
      invoice.cancellation = { at: now, reason: parsed.data.reason };
      return reply(200, invoiceDto(invoice));
    }
  }
  return fail(404, 'NOT_FOUND', 'Introuvable.');
}
