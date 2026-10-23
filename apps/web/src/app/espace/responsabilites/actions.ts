'use server';

import {
  changeResponsibilityStatusSchema,
  createResponsibilitySchema,
  type ResponsibilityDto,
} from '@nagaw/shared';
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiErrorState } from '@/lib/api/form-error';
import { apiAsUser, getSession } from '@/lib/api/server';
import { parseValues, type FormState } from '@/lib/auth/schemas';

async function requireToken() {
  const session = await getSession();
  if (session.status !== 'signed-in') redirect('/connexion');
  return session.accessToken;
}

function text(formData: FormData, name: string): string {
  return formData.get(name)?.toString() ?? '';
}

/** Form fields as the shared schema expects them. */
function values(formData: FormData) {
  return {
    assigneeUserId: text(formData, 'assigneeUserId'),
    title: text(formData, 'title'),
    objective: text(formData, 'objective'),
    scope: text(formData, 'scope'),
    rules: text(formData, 'rules'),
    successCriteria: text(formData, 'successCriteria'),
    maxRunsPerDay: text(formData, 'maxRunsPerDay'),
    escalationUserId: text(formData, 'escalationUserId'),
    startsOn: text(formData, 'startsOn'),
    endsOn: text(formData, 'endsOn'),
  };
}

export async function saveResponsibility(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const accessToken = await requireToken();
  const organizationId = text(formData, 'organizationId');
  const responsibilityId = text(formData, 'responsibilityId');
  const parsed = parseValues(createResponsibilitySchema, values(formData));
  if (!parsed.ok) return parsed.state;

  const result = await apiAsUser<ResponsibilityDto>(accessToken, {
    method: responsibilityId ? 'PUT' : 'POST',
    path: responsibilityId
      ? `/responsibilities/${encodeURIComponent(responsibilityId)}`
      : '/responsibilities',
    organizationId,
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);
  if (!responsibilityId) redirect(`/espace/responsabilites/${result.data.id}`);
  refresh();
  return { status: 'success', message: 'Responsabilité enregistrée.' };
}

export async function changeResponsibilityStatus(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const accessToken = await requireToken();
  const parsed = parseValues(changeResponsibilityStatusSchema, {
    status: text(formData, 'status'),
  });
  if (!parsed.ok) return parsed.state;

  const result = await apiAsUser<ResponsibilityDto>(accessToken, {
    method: 'POST',
    path: `/responsibilities/${encodeURIComponent(text(formData, 'responsibilityId'))}/status`,
    organizationId: text(formData, 'organizationId'),
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);
  refresh();
  return { status: 'success', message: 'Statut mis à jour.' };
}
