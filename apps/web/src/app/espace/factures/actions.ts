'use server';

import {
  cancelInvoiceSchema,
  changeQuoteStatusSchema,
  createInvoiceSchema,
  createQuoteSchema,
  fromSaleSchema,
  invoicePaymentSchema,
  parseAmount,
  updateInvoiceSchema,
  updateQuoteSchema,
  type InvoiceDto,
  type QuoteDto,
} from '@nagaw/shared';
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiErrorState } from '@/lib/api/form-error';
import { apiAsUser } from '@/lib/api/server';
import { parseValues, type FormState } from '@/lib/auth/schemas';
import { amountField, optionalIdField } from '@/lib/catalog/form';
import { requireReadyWorkspace } from '@/lib/workspace/load';

/** The page's shop must still be the active one (currency, permissions). */
async function shopOf(organizationId: string | undefined) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) redirect('/espace');
  if (organizationId !== workspace.organization.id) return null;
  return {
    token: workspace.accessToken,
    organizationId: workspace.organization.id,
    currency: workspace.organization.defaultCurrency,
  };
}

const SHOP_CHANGED =
  'La boutique active a changé dans un autre onglet. Rechargez la page.';

const UNREADABLE = 'Formulaire illisible : rechargez la page et recommencez.';

const text = (formData: FormData, name: string) =>
  formData.get(name)?.toString() ?? '';
const id = (formData: FormData, name: string) =>
  encodeURIComponent(text(formData, name));

/** What the editor sends: amounts and quantities as typed. */
interface EditorPayload {
  customerId: string;
  lines: {
    productId: string | null;
    label: string;
    unit: string;
    quantity: string;
    unitPrice: string;
    taxRateBasisPoints: number | null;
  }[];
  discount: string;
  notes: string;
  date: string;
}

function quantity(value: string): number {
  const compact = value.replace(/[\s  ]/g, '');
  return /^\d+(?:[.,]\d+)?$/.test(compact)
    ? Number(compact.replace(',', '.'))
    : Number.NaN;
}

/** Editor payload → values of the shared schemas (NaN reports a field). */
function documentValues(formData: FormData, currency: string) {
  let payload: EditorPayload;
  try {
    payload = JSON.parse(text(formData, 'document')) as EditorPayload;
  } catch {
    // Only a tampered or truncated request gets here: the form says so.
    return null;
  }
  if (!Array.isArray(payload?.lines)) return null;
  return {
    customerId: payload.customerId,
    lines: payload.lines.map((line) => ({
      productId: line.productId,
      label: line.label,
      unit: line.unit,
      quantity: quantity(line.quantity),
      unitPrice: parseAmount(line.unitPrice, currency) ?? Number.NaN,
      taxRateBasisPoints: line.taxRateBasisPoints,
    })),
    discount:
      payload.discount.trim() === ''
        ? 0
        : (parseAmount(payload.discount, currency) ?? Number.NaN),
    notes: payload.notes,
    date: payload.date.trim() === '' ? null : payload.date,
  };
}

// ---------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------

export async function saveQuote(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const shop = await shopOf(text(formData, 'organizationId'));
  if (!shop) return { status: 'error', message: SHOP_CHANGED };
  const document = documentValues(formData, shop.currency);
  if (!document) return { status: 'error', message: UNREADABLE };
  const { date, ...values } = document;
  const quoteId = text(formData, 'documentId');
  const parsed = quoteId
    ? parseValues(updateQuoteSchema, { ...values, validUntil: date ?? '' })
    : parseValues(createQuoteSchema, {
        ...values,
        validUntil: date,
        clientOperationId: text(formData, 'clientOperationId'),
      });
  if (!parsed.ok) return parsed.state;
  const result = await apiAsUser<QuoteDto>(shop.token, {
    method: quoteId ? 'PUT' : 'POST',
    path: quoteId ? `/quotes/${encodeURIComponent(quoteId)}` : '/quotes',
    organizationId: shop.organizationId,
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);
  redirect(`/espace/factures/devis/${result.data.id}`);
}

export async function changeQuoteStatus(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const shop = await shopOf(text(formData, 'organizationId'));
  if (!shop) return { status: 'error', message: SHOP_CHANGED };
  const parsed = parseValues(changeQuoteStatusSchema, {
    status: text(formData, 'status'),
  });
  if (!parsed.ok) return parsed.state;
  const result = await apiAsUser<QuoteDto>(shop.token, {
    method: 'POST',
    path: `/quotes/${id(formData, 'quoteId')}/status`,
    organizationId: shop.organizationId,
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);
  refresh();
  return { status: 'success', message: 'Statut du devis enregistré.' };
}

export async function invoiceFromQuote(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const shop = await shopOf(text(formData, 'organizationId'));
  if (!shop) return { status: 'error', message: SHOP_CHANGED };
  const result = await apiAsUser<InvoiceDto>(shop.token, {
    method: 'POST',
    path: `/quotes/${id(formData, 'quoteId')}/invoice`,
    organizationId: shop.organizationId,
    body: { clientOperationId: text(formData, 'clientOperationId') },
  });
  if (!result.ok) return apiErrorState(result);
  redirect(`/espace/factures/${result.data.id}`);
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

export async function saveInvoice(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const shop = await shopOf(text(formData, 'organizationId'));
  if (!shop) return { status: 'error', message: SHOP_CHANGED };
  const document = documentValues(formData, shop.currency);
  if (!document) return { status: 'error', message: UNREADABLE };
  const { date, ...values } = document;
  const invoiceId = text(formData, 'documentId');
  const parsed = invoiceId
    ? parseValues(updateInvoiceSchema, { ...values, dueDate: date })
    : parseValues(createInvoiceSchema, {
        ...values,
        dueDate: date,
        clientOperationId: text(formData, 'clientOperationId'),
      });
  if (!parsed.ok) return parsed.state;
  const result = await apiAsUser<InvoiceDto>(shop.token, {
    method: invoiceId ? 'PUT' : 'POST',
    path: invoiceId
      ? `/invoices/${encodeURIComponent(invoiceId)}`
      : '/invoices',
    organizationId: shop.organizationId,
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);
  redirect(`/espace/factures/${result.data.id}`);
}

export async function invoiceFromSale(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const shop = await shopOf(text(formData, 'organizationId'));
  if (!shop) return { status: 'error', message: SHOP_CHANGED };
  const parsed = parseValues(fromSaleSchema, {
    customerId: optionalIdField(formData, 'customerId'),
    clientOperationId: text(formData, 'clientOperationId'),
  });
  if (!parsed.ok) return parsed.state;
  const result = await apiAsUser<InvoiceDto>(shop.token, {
    method: 'POST',
    path: `/invoices/from-sale/${id(formData, 'saleId')}`,
    organizationId: shop.organizationId,
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);
  redirect(`/espace/factures/${result.data.id}`);
}

export async function issueInvoice(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const shop = await shopOf(text(formData, 'organizationId'));
  if (!shop) return { status: 'error', message: SHOP_CHANGED };
  const result = await apiAsUser<InvoiceDto>(shop.token, {
    method: 'POST',
    path: `/invoices/${id(formData, 'invoiceId')}/issue`,
    organizationId: shop.organizationId,
  });
  if (!result.ok) return apiErrorState(result);
  refresh();
  return {
    status: 'success',
    message: `Facture ${result.data.number} émise : elle ne peut plus être modifiée.`,
  };
}

export async function addInvoicePayment(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const shop = await shopOf(text(formData, 'organizationId'));
  if (!shop) return { status: 'error', message: SHOP_CHANGED };
  const method = text(formData, 'method');
  const parsed = parseValues(invoicePaymentSchema, {
    method,
    amount: amountField(formData, 'amount', shop.currency),
    provider:
      method === 'mobile_money' ? optionalIdField(formData, 'provider') : null,
    reference: text(formData, 'reference'),
    paidOn: text(formData, 'paidOn'),
    clientOperationId: text(formData, 'clientOperationId'),
  });
  if (!parsed.ok) return parsed.state;
  const result = await apiAsUser<InvoiceDto>(shop.token, {
    method: 'POST',
    path: `/invoices/${id(formData, 'invoiceId')}/payments`,
    organizationId: shop.organizationId,
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);
  refresh();
  return { status: 'success', message: 'Paiement enregistré.' };
}

export async function cancelInvoice(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const shop = await shopOf(text(formData, 'organizationId'));
  if (!shop) return { status: 'error', message: SHOP_CHANGED };
  const parsed = parseValues(cancelInvoiceSchema, {
    reason: text(formData, 'reason'),
    clientOperationId: text(formData, 'clientOperationId'),
  });
  if (!parsed.ok) return parsed.state;
  const result = await apiAsUser<InvoiceDto>(shop.token, {
    method: 'POST',
    path: `/invoices/${id(formData, 'invoiceId')}/cancel`,
    organizationId: shop.organizationId,
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);
  refresh();
  return {
    status: 'success',
    message: `Facture annulée par l’avoir ${result.data.creditNote?.number ?? ''}.`,
  };
}
