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
    return { status: 'error', message: 'Boutique inconnue.' };

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
  return { status: 'success', message: 'Modification enregistrée.' };
}

/**
 * Largest reduction (negotiated prices and discount) a person may give on
 * a sale, typed in percent; empty: no limit (ADR-038).
 */
export async function setDiscountLimit(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const accessToken = await requireToken();
  const organizationId = takeOrganizationId(formData);
  const userId = formData.get('userId')?.toString();
  if (!organizationId || !userId)
    return { status: 'error', message: 'Membre inconnu.' };
  const typed = (formData.get('percent')?.toString() ?? '')
    .replace(/[\s%]/g, '')
    .replace(',', '.');
  const percent = typed === '' ? null : Number(typed);
  if (percent !== null && (!/^\d+(\.\d{1,2})?$/.test(typed) || percent > 100))
    return {
      status: 'error',
      message: 'Tapez un pourcentage entre 0 et 100, ou laissez vide.',
      fieldErrors: { percent: 'Entre 0 et 100, par exemple 10.' },
    };
  const result = await apiAsUser<MemberDto>(accessToken, {
    method: 'PATCH',
    path: `/organizations/current/members/${encodeURIComponent(userId)}`,
    organizationId,
    body: {
      maxDiscountBasisPoints:
        percent === null ? null : Math.round(percent * 100),
    },
  });
  if (!result.ok) return { status: 'error', message: result.message };
  refresh();
  return {
    status: 'success',
    message:
      percent === null
        ? 'Sans limite : cette personne négocie librement.'
        : `Limite enregistrée : ${typed.replace('.', ',')} % au plus.`,
  };
}
