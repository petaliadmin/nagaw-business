'use server';

import {
  createOrganizationSchema,
  type OrganizationWithRoleDto,
} from '@nagaw/shared';
import { redirect } from 'next/navigation';
import { apiAsUser, getSession } from '@/lib/api/server';
import { parseForm, type FormState } from '@/lib/auth/schemas';

export async function createOrganization(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await getSession();
  if (session.status !== 'signed-in') redirect('/connexion');

  const parsed = parseForm(createOrganizationSchema, formData);
  if (!parsed.ok) return parsed.state;

  const result = await apiAsUser<OrganizationWithRoleDto>(session.accessToken, {
    method: 'POST',
    path: '/organizations',
    body: parsed.data,
  });
  if (!result.ok) return { status: 'error', message: result.message };
  redirect('/espace');
}
