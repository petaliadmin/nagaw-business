'use server';

import { planChangeRequestSchema, type SubscriptionDto } from '@nagaw/shared';
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiErrorState } from '@/lib/api/form-error';
import { apiAsUser } from '@/lib/api/server';
import { parseValues, type FormState } from '@/lib/auth/schemas';
import { requireReadyWorkspace } from '@/lib/workspace/load';

/** The page's shop must still be the active one. */
async function shopOf(organizationId: string | undefined) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) redirect('/espace');
  if (organizationId !== workspace.organization.id) return null;
  return {
    token: workspace.accessToken,
    organizationId: workspace.organization.id,
  };
}

const SHOP_CHANGED =
  'La boutique active a changé dans un autre onglet. Rechargez la page.';

const text = (formData: FormData, name: string) =>
  formData.get(name)?.toString() ?? '';

export async function requestPlan(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const shop = await shopOf(text(formData, 'organizationId'));
  if (!shop) return { status: 'error', message: SHOP_CHANGED };
  const parsed = parseValues(planChangeRequestSchema, {
    planKey: text(formData, 'planKey'),
  });
  if (!parsed.ok) return parsed.state;
  const result = await apiAsUser<SubscriptionDto>(shop.token, {
    method: 'POST',
    path: '/subscription/requests',
    organizationId: shop.organizationId,
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);
  refresh();
  return {
    status: 'success',
    message: `Demande de passage à l’offre ${result.data.pendingRequest?.plan.name ?? ''} enregistrée.`,
  };
}

export async function cancelPlanRequest(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const shop = await shopOf(text(formData, 'organizationId'));
  if (!shop) return { status: 'error', message: SHOP_CHANGED };
  const result = await apiAsUser<SubscriptionDto>(shop.token, {
    method: 'POST',
    path: '/subscription/requests/cancel',
    organizationId: shop.organizationId,
  });
  if (!result.ok) return apiErrorState(result);
  refresh();
  return { status: 'success', message: 'Demande annulée.' };
}
