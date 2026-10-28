'use server';

import {
  NOTIFICATION_CATEGORIES,
  pushSubscriptionSchema,
  updateNotificationSettingsSchema,
  type NotificationPreferenceDto,
  type NotificationSettingsDto,
} from '@nagaw/shared';
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiErrorState } from '@/lib/api/form-error';
import { apiAsUser } from '@/lib/api/server';
import { parseValues, type FormState } from '@/lib/auth/schemas';
import { safeNotificationLink } from '@/lib/notifications/labels';
import { requireReadyWorkspace } from '@/lib/workspace/load';

const text = (formData: FormData, name: string) =>
  formData.get(name)?.toString() ?? '';

const SHOP_CHANGED: FormState = {
  status: 'error',
  message:
    'La boutique active a changé dans un autre onglet. Rechargez la page.',
};

/**
 * Marks one notification (or all of them) as read, then opens the page it
 * points to, if any. The link is checked again: only a page of the app.
 */
export async function openNotification(formData: FormData): Promise<void> {
  const workspace = await requireReadyWorkspace();
  if (!workspace) redirect('/espace');
  if (text(formData, 'organizationId') !== workspace.organization.id)
    redirect('/espace/notifications');
  const id = text(formData, 'id');
  const result = await apiAsUser<{ unread: number }>(workspace.accessToken, {
    method: 'POST',
    path: '/notifications/read',
    organizationId: workspace.organization.id,
    body: id ? { ids: [id] } : {},
  });
  if (!result.ok)
    console.error('Notification non marquée comme lue', {
      status: result.status,
      code: result.code,
    });
  const link = safeNotificationLink(text(formData, 'link'));
  refresh();
  if (link) redirect(link);
}

export async function updatePreferences(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const workspace = await requireReadyWorkspace();
  if (!workspace) redirect('/espace');
  if (text(formData, 'organizationId') !== workspace.organization.id)
    return SHOP_CHANGED;
  // Only the categories shown in the form are sent: those of the role.
  const preferences = NOTIFICATION_CATEGORIES.filter(
    (category) => formData.get(`shown-${category}`) === '1',
  ).map((category) => ({
    category,
    enabled: formData.get(`enabled-${category}`) === 'on',
    push: formData.get(`push-${category}`) === 'on',
  }));
  if (preferences.length === 0)
    return { status: 'error', message: 'Rien à enregistrer.' };
  const result = await apiAsUser<NotificationPreferenceDto[]>(
    workspace.accessToken,
    {
      method: 'PUT',
      path: '/notifications/preferences',
      organizationId: workspace.organization.id,
      body: { preferences },
    },
  );
  if (!result.ok) return apiErrorState(result);
  refresh();
  return { status: 'success', message: 'Vos choix sont enregistrés.' };
}

export async function updateNotificationSettings(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const workspace = await requireReadyWorkspace();
  if (!workspace) redirect('/espace');
  if (text(formData, 'organizationId') !== workspace.organization.id)
    return SHOP_CHANGED;
  const parsed = parseValues(updateNotificationSettingsSchema, {
    sellerStockCorrectionMax: text(formData, 'sellerStockCorrectionMax'),
    stockForecastDays: text(formData, 'stockForecastDays'),
    stockForecastWindowDays: text(formData, 'stockForecastWindowDays'),
    creditOverdueDays: text(formData, 'creditOverdueDays'),
    creditNearLimitPercent: text(formData, 'creditNearLimitPercent'),
    dailySummaryHour: text(formData, 'dailySummaryHour'),
    // A checkbox: absent when unchecked (ADR-038).
    sellerCanSellBelowCost: text(formData, 'sellerCanSellBelowCost') === 'on',
  });
  if (!parsed.ok) return parsed.state;
  const result = await apiAsUser<NotificationSettingsDto>(
    workspace.accessToken,
    {
      method: 'PATCH',
      path: '/notifications/settings',
      organizationId: workspace.organization.id,
      body: parsed.data,
    },
  );
  if (!result.ok) return apiErrorState(result);
  refresh();
  return { status: 'success', message: 'Réglages enregistrés.' };
}

/** Registers this browser for push messages (the person's, any shop). */
export async function subscribePush(
  subscription: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return { ok: false, message: 'Reconnectez-vous.' };
  const parsed = pushSubscriptionSchema.safeParse(subscription);
  if (!parsed.success)
    return {
      ok: false,
      message: 'Ce navigateur a donné un abonnement invalide.',
    };
  const result = await apiAsUser<null>(workspace.accessToken, {
    method: 'POST',
    path: '/push/subscriptions',
    body: parsed.data,
  });
  return result.ok
    ? { ok: true }
    : { ok: false, message: `Enregistrement impossible : ${result.message}` };
}

export async function unsubscribePush(
  endpoint: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return { ok: false, message: 'Reconnectez-vous.' };
  const result = await apiAsUser<null>(workspace.accessToken, {
    method: 'POST',
    path: '/push/subscriptions/remove',
    body: { endpoint },
  });
  return result.ok
    ? { ok: true }
    : { ok: false, message: `Arrêt impossible : ${result.message}` };
}
