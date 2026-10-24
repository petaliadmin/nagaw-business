'use server';

import {
  cancelSaleSchema,
  createCustomerSchema,
  createSaleSchema,
  customerRepaymentSchema,
  updateCustomerSchema,
  type CreateSaleInput,
  type CustomerDto,
  type SaleDto,
} from '@nagaw/shared';
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiErrorState } from '@/lib/api/form-error';
import { apiAsUser } from '@/lib/api/server';
import { parseValues, type FormState } from '@/lib/auth/schemas';
import {
  optionalAmountField,
  optionalIdField,
  amountField,
} from '@/lib/catalog/form';
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

export type SaleResult =
  | { ok: true; saleId: string }
  | {
      ok: false;
      message: string;
      fieldErrors?: Record<string, string>;
      /** Prices changed since the page was loaded: reload them. */
      pricesChanged?: boolean;
    };

/** Called by the checkout with the cart (not a form: lines are dynamic). */
export async function recordSale(
  organizationId: string,
  input: CreateSaleInput,
): Promise<SaleResult> {
  const shop = await shopOf(organizationId);
  if (!shop) return { ok: false, message: SHOP_CHANGED };
  const parsed = parseValues(createSaleSchema, input);
  if (!parsed.ok)
    return {
      ok: false,
      message: parsed.state.message ?? 'Vérifiez la vente.',
      fieldErrors: parsed.state.fieldErrors,
    };
  const result = await apiAsUser<SaleDto>(shop.token, {
    method: 'POST',
    path: '/sales',
    organizationId: shop.organizationId,
    body: parsed.data,
  });
  if (!result.ok) {
    const state = apiErrorState(result);
    return {
      ok: false,
      message: result.message,
      fieldErrors: state.fieldErrors,
      pricesChanged: result.code === 'PRICE_CHANGED',
    };
  }
  refresh();
  return { ok: true, saleId: result.data.id };
}

export type CustomerResult =
  | { ok: true; customer: CustomerDto }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

/** Quick creation from the checkout (name and phone). */
export async function quickCreateCustomer(
  organizationId: string,
  values: { name: string; phone: string; clientOperationId: string },
): Promise<CustomerResult> {
  const shop = await shopOf(organizationId);
  if (!shop) return { ok: false, message: SHOP_CHANGED };
  const parsed = parseValues(createCustomerSchema, values);
  if (!parsed.ok)
    return {
      ok: false,
      message: parsed.state.message ?? 'Vérifiez le client.',
      fieldErrors: parsed.state.fieldErrors,
    };
  const result = await apiAsUser<CustomerDto>(shop.token, {
    method: 'POST',
    path: '/customers',
    organizationId: shop.organizationId,
    body: parsed.data,
  });
  if (!result.ok) return { ok: false, message: result.message };
  return { ok: true, customer: result.data };
}

// ---------------------------------------------------------------------------
// Forms of the sale and customer pages
// ---------------------------------------------------------------------------

const text = (formData: FormData, name: string) =>
  formData.get(name)?.toString() ?? '';

export async function cancelSale(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const shop = await shopOf(text(formData, 'organizationId'));
  if (!shop) return { status: 'error', message: SHOP_CHANGED };
  const parsed = parseValues(cancelSaleSchema, {
    reason: text(formData, 'reason'),
  });
  if (!parsed.ok) return parsed.state;
  const result = await apiAsUser<SaleDto>(shop.token, {
    method: 'POST',
    path: `/sales/${encodeURIComponent(text(formData, 'saleId'))}/cancel`,
    organizationId: shop.organizationId,
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);
  refresh();
  return {
    status: 'success',
    message: 'Vente annulée : les articles sont revenus dans le stock.',
  };
}

export async function createCustomer(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const shop = await shopOf(text(formData, 'organizationId'));
  if (!shop) return { status: 'error', message: SHOP_CHANGED };
  const parsed = parseValues(createCustomerSchema, {
    name: text(formData, 'name'),
    phone: text(formData, 'phone'),
    notes: text(formData, 'notes'),
    creditLimit: optionalAmountField(formData, 'creditLimit', shop.currency),
    clientOperationId: text(formData, 'clientOperationId'),
  });
  if (!parsed.ok) return parsed.state;
  const result = await apiAsUser<CustomerDto>(shop.token, {
    method: 'POST',
    path: '/customers',
    organizationId: shop.organizationId,
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);
  redirect(`/espace/clients/${result.data.id}`);
}

export async function updateCustomer(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const shop = await shopOf(text(formData, 'organizationId'));
  if (!shop) return { status: 'error', message: SHOP_CHANGED };
  const parsed = parseValues(updateCustomerSchema, {
    name: text(formData, 'name'),
    phone: text(formData, 'phone'),
    notes: text(formData, 'notes'),
    creditLimit: optionalAmountField(formData, 'creditLimit', shop.currency),
  });
  if (!parsed.ok) return parsed.state;
  const result = await apiAsUser<CustomerDto>(shop.token, {
    method: 'PATCH',
    path: `/customers/${encodeURIComponent(text(formData, 'customerId'))}`,
    organizationId: shop.organizationId,
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);
  refresh();
  return { status: 'success', message: 'Client enregistré.' };
}

export async function recordRepayment(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const shop = await shopOf(text(formData, 'organizationId'));
  if (!shop) return { status: 'error', message: SHOP_CHANGED };
  const method = text(formData, 'method');
  const parsed = parseValues(customerRepaymentSchema, {
    method,
    amount: amountField(formData, 'amount', shop.currency),
    provider:
      method === 'mobile_money' ? optionalIdField(formData, 'provider') : null,
    reference: text(formData, 'reference'),
    clientOperationId: text(formData, 'clientOperationId'),
  });
  if (!parsed.ok) return parsed.state;
  const result = await apiAsUser<CustomerDto>(shop.token, {
    method: 'POST',
    path: `/customers/${encodeURIComponent(text(formData, 'customerId'))}/payments`,
    organizationId: shop.organizationId,
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);
  refresh();
  return { status: 'success', message: 'Remboursement enregistré.' };
}
