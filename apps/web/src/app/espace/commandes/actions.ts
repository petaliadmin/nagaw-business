'use server';

import {
  cancelOrderSchema,
  catalogSettingsSchema,
  deliverOrderSchema,
  orderPaymentSchema,
  shipOrderSchema,
  type CatalogSettingsDto,
  type OrderDto,
} from '@nagaw/shared';
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiAsUser, getSession } from '@/lib/api/server';
import { amountField } from '@/lib/catalog/form';
import { parseValues, type FormState } from '@/lib/auth/schemas';

async function requireSession() {
  const session = await getSession();
  if (session.status !== 'signed-in') redirect('/connexion');
  return session;
}

const ids = (formData: FormData) => ({
  organizationId: formData.get('organizationId')?.toString() ?? '',
  orderId: formData.get('orderId')?.toString() ?? '',
});

/** A payment from the form: cash, or Mobile Money with its operator. */
function paymentOf(formData: FormData) {
  const choice = formData.get('payment')?.toString() ?? '';
  if (choice === 'cash') return { method: 'cash' as const, provider: null };
  return {
    method: 'mobile_money' as const,
    provider: choice || null,
    reference: formData.get('reference')?.toString() ?? '',
  };
}

async function step(
  formData: FormData,
  action: string,
  body: object | undefined,
  done: string,
): Promise<FormState> {
  const session = await requireSession();
  const { organizationId, orderId } = ids(formData);
  if (!organizationId || !orderId)
    return { status: 'error', message: 'Commande inconnue.' };
  // The API checks membership, the role and the step.
  const result = await apiAsUser<OrderDto>(session.accessToken, {
    method: 'POST',
    path: `/orders/${encodeURIComponent(orderId)}/${action}`,
    organizationId,
    body: body ?? {},
  });
  if (!result.ok) return { status: 'error', message: result.message };
  refresh();
  return { status: 'success', message: done };
}

export async function confirmOrder(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return step(formData, 'confirm', undefined, 'Commande confirmée.');
}

export async function payOrder(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = orderPaymentSchema.safeParse(paymentOf(formData));
  if (!parsed.success)
    return {
      status: 'error',
      message: 'Choisissez comment le client a payé.',
      fieldErrors: { payment: 'Choisissez comment le client a payé.' },
    };
  return step(formData, 'pay', parsed.data, 'Paiement enregistré.');
}

export async function shipOrder(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const currency = formData.get('currency')?.toString() || 'XOF';
  const fee = formData.get('deliveryFee')?.toString().trim() ?? '';
  const parsed = parseValues(shipOrderSchema, {
    courierName: formData.get('courierName')?.toString() ?? '',
    courierPhone: formData.get('courierPhone')?.toString() ?? '',
    deliveryFee:
      fee === '' ? 0 : amountField(formData, 'deliveryFee', currency),
  });
  if (!parsed.ok) return parsed.state;
  return step(formData, 'ship', parsed.data, 'Commande partie en livraison.');
}

export async function deliverOrder(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const paid = formData.get('paid') === 'on';
  const parsed = deliverOrderSchema.safeParse({
    payment: paid ? null : paymentOf(formData),
  });
  if (!parsed.success)
    return {
      status: 'error',
      message: 'Choisissez comment le client a payé.',
      fieldErrors: { payment: 'Choisissez comment le client a payé.' },
    };
  return step(
    formData,
    'deliver',
    parsed.data,
    'Commande livrée : la vente est enregistrée.',
  );
}

export async function cancelOrder(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseValues(cancelOrderSchema, {
    reason: formData.get('reason')?.toString() ?? '',
  });
  if (!parsed.ok) return parsed.state;
  return step(formData, 'cancel', parsed.data, 'Commande annulée.');
}

/** Settings of the public page, in Paramètres. */
export async function updateCatalogSettings(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const organizationId = formData.get('organizationId')?.toString();
  if (!organizationId)
    return { status: 'error', message: 'Boutique inconnue.' };
  const parsed = parseValues(catalogSettingsSchema, {
    published: formData.get('published') === 'on',
    waveNumber: formData.get('waveNumber')?.toString() ?? '',
    orangeMoneyNumber: formData.get('orangeMoneyNumber')?.toString() ?? '',
    note: formData.get('note')?.toString() ?? '',
  });
  if (!parsed.ok) return parsed.state;
  const result = await apiAsUser<CatalogSettingsDto>(session.accessToken, {
    method: 'PUT',
    path: '/orders/settings',
    organizationId,
    body: parsed.data,
  });
  if (!result.ok) return { status: 'error', message: result.message };
  refresh();
  return {
    status: 'success',
    message: parsed.data.published
      ? 'Catalogue en ligne : partagez le lien.'
      : 'Catalogue fermé.',
  };
}
