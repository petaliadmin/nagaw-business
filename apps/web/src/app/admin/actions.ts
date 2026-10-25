'use server';

import {
  adminResolveRequestSchema,
  adminSetPlanSchema,
  adminSuspendSchema,
  type AdminPlanRequestDto,
  type AdminShopDto,
} from '@nagaw/shared';
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { requirePlatformAdmin } from '@/lib/admin/load';
import { apiErrorState } from '@/lib/api/form-error';
import { apiAsUser } from '@/lib/api/server';
import { parseValues, type FormState } from '@/lib/auth/schemas';

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

export async function setShopPlan(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await adminToken();
  const parsed = parseValues(adminSetPlanSchema, {
    planKey: text(formData, 'planKey'),
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
