'use server';

import {
  createOrganizationSchema,
  invitationTokenSchema,
  updateOrganizationSchema,
  type MeDto,
  type OrganizationDto,
  type OrganizationWithRoleDto,
} from '@nagaw/shared';
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiAsUser, getSession } from '@/lib/api/server';
import { parseForm, type FormState } from '@/lib/auth/schemas';
import { rememberOrganization } from '@/lib/workspace/remember';

async function requireSession() {
  const session = await getSession();
  if (session.status !== 'signed-in') redirect('/connexion');
  return session;
}

export async function createOrganization(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const parsed = parseForm(createOrganizationSchema, formData);
  if (!parsed.ok) return parsed.state;

  const result = await apiAsUser<OrganizationWithRoleDto>(session.accessToken, {
    method: 'POST',
    path: '/organizations',
    body: parsed.data,
  });
  if (!result.ok) return { status: 'error', message: result.message };
  await rememberOrganization(result.data.id);
  redirect('/espace');
}

/**
 * Switches the active organization, only to one the API lists for this
 * user. The cookie is a display preference, never an authorization.
 */
export async function selectOrganization(formData: FormData): Promise<void> {
  const session = await requireSession();
  const requested = formData.get('organizationId')?.toString();
  const me = await apiAsUser<MeDto>(session.accessToken, { path: '/me' });
  if (!me.ok) throw new Error(`Boutiques indisponibles : ${me.message}`);
  if (requested && me.data.organizations.some((org) => org.id === requested)) {
    await rememberOrganization(requested);
  }
  redirect('/espace');
}

export async function updateOrganization(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const organizationId = formData.get('organizationId')?.toString();
  formData.delete('organizationId');
  const parsed = parseForm(updateOrganizationSchema, formData);
  if (!parsed.ok) return parsed.state;
  if (!organizationId)
    return { status: 'error', message: 'Boutique inconnue.' };

  // The API checks membership and the organization.update permission.
  const result = await apiAsUser<OrganizationDto>(session.accessToken, {
    method: 'PATCH',
    path: '/organizations/current',
    organizationId,
    body: parsed.data,
  });
  if (!result.ok) return { status: 'error', message: result.message };
  // Re-render the shell too (organization name in the sidebar).
  refresh();
  return { status: 'success', message: 'Paramètres enregistrés.' };
}

/** Joins the organization of an invitation, then opens it. */
export async function acceptInvitation(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const token = invitationTokenSchema.safeParse(formData.get('token'));
  if (!token.success)
    return { status: 'error', message: 'Lien d’invitation invalide.' };

  const result = await apiAsUser<OrganizationWithRoleDto>(session.accessToken, {
    method: 'POST',
    path: '/invitations/accept',
    body: { token: token.data },
  });
  if (!result.ok) return { status: 'error', message: result.message };
  await rememberOrganization(result.data.id);
  redirect('/espace');
}
