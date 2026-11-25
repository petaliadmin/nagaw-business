'use server';

import {
  adminPlanUpdateSchema,
  type AdminPlanDto,
  adminDataActionSchema,
  adminArchiveSchema,
  type AdminUserDto,
  adminInvoiceDecisionSchema,
  adminRenewSchema,
  adminSubscriptionSettingsSchema,
  answerFeedbackSchema,
  adminOpenAccessSchema,
  adminResolveRequestSchema,
  adminSetPlanSchema,
  adminSuspendSchema,
  type AdminFeedbackDto,
  type AdminPlanRequestDto,
  type AdminShopDto,
} from '@nagaw/shared';
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { requirePlatformAdmin } from '@/lib/admin/load';
import { apiErrorState } from '@/lib/api/form-error';
import { apiAsUser } from '@/lib/api/server';
import {
  newPinFormSchema,
  parseForm,
  parseValues,
  type FormState,
} from '@/lib/auth/schemas';
import { rememberOrganization } from '@/lib/workspace/remember';

/** The API checks the administrator again on every call (ADR-030). */
async function adminToken() {
  const admin = await requirePlatformAdmin();
  if (!admin) redirect('/espace');
  return admin.accessToken;
}

const text = (formData: FormData, name: string) =>
  formData.get(name)?.toString() ?? '';
const id = (formData: FormData, name: string) =>
  encodeURIComponent(text(formData, name));

/**
 * A forgotten secret code (ADR-058): the team, having checked who calls,
 * gives the member a new one, which it tells them.
 */
export async function setMemberPin(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await adminToken();
  const shopId = id(formData, 'shopId');
  const userId = id(formData, 'userId');
  formData.delete('shopId');
  formData.delete('userId');
  const parsed = parseForm(newPinFormSchema, formData);
  if (!parsed.ok) return parsed.state;
  const result = await apiAsUser<null>(token, {
    method: 'POST',
    path: `/admin/shops/${shopId}/members/${userId}/pin`,
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);
  return {
    status: 'success',
    message:
      'Nouveau code enregistré. Donnez-le à la personne : elle peut se connecter tout de suite.',
  };
}

export async function setShopPlan(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await adminToken();
  const parsed = parseValues(adminSetPlanSchema, {
    planKey: text(formData, 'planKey'),
    period: text(formData, 'period') || 'month',
    note: text(formData, 'note'),
  });
  if (!parsed.ok) return parsed.state;
  const result = await apiAsUser<AdminShopDto>(token, {
    method: 'POST',
    path: `/admin/shops/${id(formData, 'shopId')}/plan`,
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);
  refresh();
  return {
    status: 'success',
    message: `Boutique passée à l’offre ${result.data.plan.name}.`,
  };
}

export async function suspendShop(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await adminToken();
  const parsed = parseValues(adminSuspendSchema, {
    reason: text(formData, 'reason'),
  });
  if (!parsed.ok) return parsed.state;
  const result = await apiAsUser<AdminShopDto>(token, {
    method: 'POST',
    path: `/admin/shops/${id(formData, 'shopId')}/suspend`,
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);
  refresh();
  return {
    status: 'success',
    message: 'Boutique suspendue : ses membres n’y ont plus accès.',
  };
}

export async function reactivateShop(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await adminToken();
  const result = await apiAsUser<AdminShopDto>(token, {
    method: 'POST',
    path: `/admin/shops/${id(formData, 'shopId')}/reactivate`,
  });
  if (!result.ok) return apiErrorState(result);
  refresh();
  return { status: 'success', message: 'Boutique réactivée.' };
}

/** Enters the shop (ADR-040), then shows it as its owner would see it. */
export async function openShopAccess(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await adminToken();
  const parsed = parseValues(adminOpenAccessSchema, {
    reason: text(formData, 'reason'),
  });
  if (!parsed.ok) return parsed.state;
  const result = await apiAsUser<AdminShopDto>(token, {
    method: 'POST',
    path: `/admin/shops/${id(formData, 'shopId')}/access`,
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);
  await rememberOrganization(result.data.id);
  redirect('/espace');
}

/** Leaves the shop; from its space or from the administration. */
export async function closeShopAccess(formData: FormData): Promise<void> {
  const token = await adminToken();
  const result = await apiAsUser<AdminShopDto>(token, {
    method: 'POST',
    path: `/admin/shops/${id(formData, 'shopId')}/access/close`,
  });
  // Already closed elsewhere: the administrator is out all the same.
  if (!result.ok && result.status !== 409)
    throw new Error(`Impossible de quitter la boutique : ${result.message}`);
  redirect(`/admin/boutiques/${id(formData, 'shopId')}`);
}

export async function resolvePlanRequest(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await adminToken();
  const decision =
    text(formData, 'decision') === 'approve' ? 'approve' : 'reject';
  const parsed = parseValues(adminResolveRequestSchema, {
    note: text(formData, 'note'),
  });
  if (!parsed.ok) return parsed.state;
  const result = await apiAsUser<AdminPlanRequestDto>(token, {
    method: 'POST',
    path: `/admin/plan-requests/${id(formData, 'requestId')}/${decision}`,
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);
  // The request leaves the pending list: the shop shows the outcome.
  redirect(`/admin/boutiques/${encodeURIComponent(result.data.shop.id)}`);
}

export async function answerFeedback(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await adminToken();
  const parsed = parseValues(answerFeedbackSchema, {
    status: text(formData, 'status'),
    answer: text(formData, 'answer'),
  });
  if (!parsed.ok) return parsed.state;
  const result = await apiAsUser<AdminFeedbackDto>(token, {
    method: 'POST',
    path: `/admin/feedback/${id(formData, 'feedbackId')}`,
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);
  refresh();
  return {
    status: 'success',
    message:
      result.data.status === 'done' ? 'Avis traité.' : 'Avis marqué comme lu.',
  };
}

// ---------------------------------------------------------------------------
// Terms and invoices (ADR-073)
// ---------------------------------------------------------------------------

/** « Prolonger d’un mois / d’un an »: payment received. */
export async function renewShop(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await adminToken();
  const parsed = parseValues(adminRenewSchema, {
    period: text(formData, 'period'),
    note: text(formData, 'note'),
  });
  if (!parsed.ok) return parsed.state;
  const result = await apiAsUser<AdminShopDto>(token, {
    method: 'POST',
    path: `/admin/shops/${id(formData, 'shopId')}/renew`,
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);
  refresh();
  return { status: 'success', message: 'Abonnement prolongé.' };
}

/** Automatic renewal on or off, lifetime given or taken back. */
export async function setShopSubscription(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await adminToken();
  const field = text(formData, 'field');
  const value = text(formData, 'value') === 'true';
  const parsed = parseValues(adminSubscriptionSettingsSchema, {
    [field === 'lifetime' ? 'lifetime' : 'autoRenew']: value,
    note: text(formData, 'note'),
  });
  if (!parsed.ok) return parsed.state;
  const result = await apiAsUser<AdminShopDto>(token, {
    method: 'PATCH',
    path: `/admin/shops/${id(formData, 'shopId')}/subscription`,
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);
  refresh();
  return {
    status: 'success',
    message:
      field === 'lifetime'
        ? value
          ? 'Abonnement à vie accordé.'
          : 'Abonnement à vie retiré : une période commence aujourd’hui.'
        : value
          ? 'Renouvellement automatique activé.'
          : 'Renouvellement automatique arrêté.',
  };
}

/** The payment of an invoice received, or the invoice forgiven. */
export async function decideInvoice(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await adminToken();
  const decision = text(formData, 'decision') === 'cancel' ? 'cancel' : 'paid';
  const parsed = parseValues(adminInvoiceDecisionSchema, {
    note: text(formData, 'note'),
  });
  if (!parsed.ok) return parsed.state;
  const result = await apiAsUser<AdminShopDto>(token, {
    method: 'POST',
    path: `/admin/invoices/${id(formData, 'invoiceId')}/${decision}`,
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);
  refresh();
  return {
    status: 'success',
    message:
      decision === 'paid'
        ? 'Facture marquée payée.'
        : 'Facture annulée : rien n’est dû pour cette période.',
  };
}

// ---------------------------------------------------------------------------
// Archives (ADR-074)
// ---------------------------------------------------------------------------

/** Archive (with a reason) or restore a shop or an account. */
export async function setArchived(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await adminToken();
  const target = text(formData, 'target') === 'user' ? 'users' : 'shops';
  const restore = text(formData, 'restore') === 'true';
  const parsed = restore
    ? { ok: true as const, data: undefined }
    : parseValues(adminArchiveSchema, { reason: text(formData, 'reason') });
  if (!parsed.ok) return parsed.state;
  const result = await apiAsUser<AdminShopDto | AdminUserDto>(token, {
    method: 'POST',
    path: `/admin/${target}/${id(formData, 'targetId')}/${restore ? 'restore' : 'archive'}`,
    ...(parsed.data ? { body: parsed.data } : {}),
  });
  if (!result.ok) return apiErrorState(result);
  refresh();
  return {
    status: 'success',
    message:
      target === 'users'
        ? restore
          ? 'Compte rouvert : la personne peut se connecter.'
          : 'Compte archivé : la personne ne peut plus se connecter.'
        : restore
          ? 'Boutique restaurée : ses membres la retrouvent.'
          : 'Boutique archivée : elle est fermée et rangée, rien n’est effacé.',
  };
}

/** Archive, restore or cancel an item of a shop (ADR-074). */
export async function actOnShopData(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await adminToken();
  const action = text(formData, 'action');
  const parsed = parseValues(adminDataActionSchema, {
    reason: text(formData, 'reason'),
  });
  if (!parsed.ok) return parsed.state;
  if (action !== 'restore' && parsed.data.reason === '')
    return {
      status: 'error',
      message: 'Indiquez pourquoi.',
      fieldErrors: { reason: 'Indiquez pourquoi' },
    };
  const result = await apiAsUser<null>(token, {
    method: 'POST',
    path: `/admin/shops/${id(formData, 'shopId')}/data/${id(formData, 'kind')}/${id(formData, 'itemId')}/${encodeURIComponent(action)}`,
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);
  refresh();
  return {
    status: 'success',
    message:
      action === 'archive'
        ? 'Archivé.'
        : action === 'restore'
          ? 'Restauré.'
          : 'Annulé.',
  };
}

/** « 1 500 » → 1500; empty → null (no limit); anything else stays as is. */
function count(formData: FormData, name: string): number | null | string {
  const raw = text(formData, name).replace(/[\s  ]/g, '');
  if (raw === '') return null;
  return /^\d+$/.test(raw) ? Number(raw) : raw;
}

/** Prices, limits and modules of an offer (ADR-075). */
export async function updatePlan(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await adminToken();
  const key = text(formData, 'planKey');
  const parsed = parseValues(adminPlanUpdateSchema, {
    monthlyPrice: count(formData, 'monthlyPrice') ?? 0,
    yearlyPrice: count(formData, 'yearlyPrice'),
    limits: {
      products: count(formData, 'limits.products'),
      members: count(formData, 'limits.members'),
      devices: count(formData, 'limits.devices'),
      salesPerMonth: count(formData, 'limits.salesPerMonth'),
      invoicesPerMonth: count(formData, 'limits.invoicesPerMonth'),
      quotesPerMonth: count(formData, 'limits.quotesPerMonth'),
      customers: count(formData, 'limits.customers'),
      suppliers: count(formData, 'limits.suppliers'),
      historyMonths: count(formData, 'limits.historyMonths'),
      modules: formData.getAll('modules').map(String),
    },
  });
  if (!parsed.ok) return parsed.state;
  if (!/^[a-z_]{2,30}$/.test(key))
    return { status: 'error', message: 'Offre inconnue.' };
  const result = await apiAsUser<AdminPlanDto>(token, {
    method: 'PATCH',
    path: `/admin/plans/${key}`,
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);
  refresh();
  return {
    status: 'success',
    message: `Offre ${result.data.name} enregistrée : elle s’applique tout de suite ${
      result.data.shops === 0
        ? 'aux boutiques qui la prendront'
        : result.data.shops === 1
          ? 'à la boutique de l’offre'
          : `aux ${result.data.shops} boutiques de l’offre`
    }.`,
  };
}
