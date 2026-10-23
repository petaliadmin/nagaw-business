'use server';

import {
  createInvitationSchema,
  updateMemberSchema,
  type CreatedInvitationDto,
  type InvitationDto,
  type MemberDto,
} from '@nagaw/shared';
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiAsUser, getSession } from '@/lib/api/server';
import { parseForm, type FormState } from '@/lib/auth/schemas';
import { siteUrl } from '@/lib/env';

export type InviteState = FormState & {
  /** Shown once to the inviter, who passes it on to the invitee. */
  link?: string;
  email?: string;
  expiresAt?: string;
};

async function requireToken() {
  const session = await getSession();
  if (session.status !== 'signed-in') redirect('/connexion');
  return session.accessToken;
}

/** The organization comes from the form; the API checks membership. */
function takeOrganizationId(formData: FormData): string | null {
  const id = formData.get('organizationId')?.toString() ?? null;
  formData.delete('organizationId');
  return id;
}

export async function inviteMember(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const accessToken = await requireToken();
  const organizationId = takeOrganizationId(formData);
  const parsed = parseForm(createInvitationSchema, formData);
  if (!parsed.ok) return parsed.state;
  if (!organizationId)
    return { status: 'error', message: 'Organisation inconnue.' };

  const result = await apiAsUser<CreatedInvitationDto>(accessToken, {
    method: 'POST',
    path: '/organizations/current/invitations',
    organizationId,
    body: parsed.data,
  });
  if (!result.ok) return { status: 'error', message: result.message };
  refresh();
  return {
    status: 'success',
    message: `Invitation créée pour ${result.data.invitation.email}.`,
    link: `${siteUrl()}/invitation?jeton=${result.data.token}`,
    email: result.data.invitation.email,
    expiresAt: result.data.invitation.expiresAt,
  };
}

export async function revokeInvitation(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const accessToken = await requireToken();
  const organizationId = takeOrganizationId(formData);
  const invitationId = formData.get('invitationId')?.toString();
  if (!organizationId || !invitationId)
    return { status: 'error', message: 'Invitation inconnue.' };

  const result = await apiAsUser<InvitationDto>(accessToken, {
    method: 'POST',
    path: `/organizations/current/invitations/${encodeURIComponent(invitationId)}/revoke`,
    organizationId,
  });
  if (!result.ok) return { status: 'error', message: result.message };
  refresh();
  return { status: 'success', message: 'Invitation annulée.' };
}

export async function updateMember(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const accessToken = await requireToken();
  const organizationId = takeOrganizationId(formData);
  const userId = formData.get('userId')?.toString();
  formData.delete('userId');
  const parsed = parseForm(updateMemberSchema, formData);
  if (!parsed.ok) return parsed.state;
  if (!organizationId || !userId)
    return { status: 'error', message: 'Membre inconnu.' };

  const result = await apiAsUser<MemberDto>(accessToken, {
    method: 'PATCH',
    path: `/organizations/current/members/${encodeURIComponent(userId)}`,
    organizationId,
    body: parsed.data,
  });
  if (!result.ok) return { status: 'error', message: result.message };
  refresh();
  return { status: 'success', message: 'Membre mis à jour.' };
}
