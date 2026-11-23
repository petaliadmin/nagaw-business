'use server';

import {
  cancelOrderSchema,
  createCustomerSchema,
  createOrderSchema,
  deliverOrderSchema,
  orderDepositSchema,
  orderStatusSchema,
  parseAmount,
  type CustomerDto,
  type OrderDto,
} from '@nagaw/shared';
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiErrorState } from '@/lib/api/form-error';
import { apiAsUser } from '@/lib/api/server';
import { parseValues, type FormState } from '@/lib/auth/schemas';
import { requireReadyWorkspace } from '@/lib/workspace/load';

/** Customer orders (ADR-072); the API checks every right again. */

const text = (formData: FormData, name: string) =>
  formData.get(name)?.toString() ?? '';

async function shopOf(formData: FormData) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) redirect('/espace');
  if (text(formData, 'organizationId') !== workspace.organization.id)
    return {
      ok: false as const,
      error: {
        status: 'error',
        message:
          'La boutique active a changé dans un autre onglet. Rechargez la page.',
      } satisfies FormState,
    };
  return {
    ok: true as const,
    token: workspace.accessToken,
    organizationId: workspace.organization.id,
    currency: workspace.organization.defaultCurrency,
  };
}

/** An amount typed in the form: 0 when empty, NaN when unreadable. */
function amountOf(formData: FormData, name: string, currency: string): number {
  const value = text(formData, name).trim();
  if (value === '') return 0;
  return parseAmount(value, currency) ?? Number.NaN;
}

/** Cash, Mobile Money with its operator, or card, from the form. */
function moneyIn(formData: FormData, prefix: string) {
  const method = text(formData, `${prefix}Method`);
  return {
    method,
    provider:
      method === 'mobile_money'
        ? text(formData, `${prefix}Provider`) || null
        : null,
    reference: text(formData, `${prefix}Reference`),
  };
}

export async function createOrder(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const shop = await shopOf(formData);
  if (!shop.ok) return shop.error;
  const { token, organizationId, currency } = shop;

  let lines: unknown;
  try {
    lines = JSON.parse(text(formData, 'lines') || '[]');
  } catch (error) {
    console.error('Articles de la commande illisibles', error);
    return { status: 'error', message: 'Articles illisibles : réessayez.' };
  }
  const depositAmount = amountOf(formData, 'depositAmount', currency);
  const fulfilment = text(formData, 'fulfilment');

  // A new customer is created first, under its own operation id.
  let customerId = text(formData, 'customerId');
  if (customerId === 'nouveau') {
    const customer = parseValues(createCustomerSchema, {
      name: text(formData, 'newCustomerName'),
      phone: text(formData, 'newCustomerPhone'),
      clientOperationId: text(formData, 'customerOperationId'),
    });
    if (!customer.ok)
      return {
        ...customer.state,
        fieldErrors: {
          newCustomerName: customer.state.fieldErrors?.name ?? '',
          newCustomerPhone: customer.state.fieldErrors?.phone ?? '',
        },
      };
    const created = await apiAsUser<CustomerDto>(token, {
      method: 'POST',
      path: '/customers',
      organizationId,
      body: customer.data,
    });
    if (!created.ok) return apiErrorState(created);
    customerId = created.data.id;
  }

  const parsed = parseValues(createOrderSchema, {
    clientOperationId: text(formData, 'clientOperationId'),
    customerId,
    lines,
    dueOn: text(formData, 'dueOn'),
    dueTime: text(formData, 'dueTime') || null,
    fulfilment,
    deliveryAddress: text(formData, 'deliveryAddress'),
    deliveryLandmark: text(formData, 'deliveryLandmark'),
    deliveryPhone: text(formData, 'deliveryPhone'),
    deliveryFee:
      fulfilment === 'delivery'
        ? amountOf(formData, 'deliveryFee', currency)
        : 0,
    note: text(formData, 'note'),
    deposit:
      depositAmount === 0
        ? null
        : { ...moneyIn(formData, 'deposit'), amount: depositAmount },
  });
  if (!parsed.ok) return parsed.state;
  const result = await apiAsUser<OrderDto>(token, {
    method: 'POST',
    path: '/orders',
    organizationId,
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);
  redirect(`/espace/commandes/${result.data.id}`);
}

async function call(
  formData: FormData,
  path: (id: string) => string,
  body: (
    currency: string,
  ) => { ok: true; data: unknown } | { ok: false; state: FormState },
  done: string,
): Promise<FormState> {
  const shop = await shopOf(formData);
  if (!shop.ok) return shop.error;
  const parsed = body(shop.currency);
  if (!parsed.ok) return parsed.state;
  const result = await apiAsUser<OrderDto>(shop.token, {
    method: 'POST',
    path: path(encodeURIComponent(text(formData, 'orderId'))),
    organizationId: shop.organizationId,
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);
  refresh();
  return { status: 'success', message: done };
}

export async function setOrderStatus(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return call(
    formData,
    (id) => `/orders/${id}/status`,
    () => parseValues(orderStatusSchema, { status: text(formData, 'status') }),
    'Étape enregistrée.',
  );
}

export async function receiveDeposit(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return call(
    formData,
    (id) => `/orders/${id}/payments`,
    (currency) =>
      parseValues(orderDepositSchema, {
        ...moneyIn(formData, 'deposit'),
        amount: amountOf(formData, 'depositAmount', currency),
        clientOperationId: text(formData, 'clientOperationId'),
      }),
    'Avance enregistrée.',
  );
}

export async function deliverOrder(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const shop = await shopOf(formData);
  if (!shop.ok) return shop.error;
  const remaining = Number(text(formData, 'remaining'));
  const method = text(formData, 'method');
  const cashReceived = amountOf(formData, 'cashReceived', shop.currency);
  const parsed = parseValues(deliverOrderSchema, {
    payments:
      remaining > 0
        ? [
            {
              method,
              amount: remaining,
              provider:
                method === 'mobile_money'
                  ? text(formData, 'provider') || null
                  : null,
              reference: text(formData, 'reference'),
            },
          ]
        : [],
    cashReceived: method === 'cash' && cashReceived > 0 ? cashReceived : null,
  });
  if (!parsed.ok) return parsed.state;
  const result = await apiAsUser<OrderDto>(shop.token, {
    method: 'POST',
    path: `/orders/${encodeURIComponent(text(formData, 'orderId'))}/deliver`,
    organizationId: shop.organizationId,
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);
  // The ticket of the sale, to hand over or send.
  redirect(`/espace/ventes/${result.data.saleId}`);
}

export async function cancelOrder(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const refund = formData.has('refundMethod')
    ? moneyIn(formData, 'refund')
    : null;
  return call(
    formData,
    (id) => `/orders/${id}/cancel`,
    () =>
      parseValues(cancelOrderSchema, {
        reason: text(formData, 'reason'),
        refund,
      }),
    'Commande annulée.',
  );
}
