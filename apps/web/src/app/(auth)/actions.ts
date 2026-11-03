'use server';

import type { PhoneSessionDto } from '@nagaw/shared';
import { redirect } from 'next/navigation';
import { apiErrorState } from '@/lib/api/form-error';
import type { ApiResult } from '@/lib/api/call-api';
import { apiAsUser, apiPublic, getSession } from '@/lib/api/server';
import { siteUrl } from '@/lib/env';
import { authErrorMessage } from '@/lib/auth/messages';
import { safeNextPath } from '@/lib/auth/redirect';
import {
  newPasswordSchema,
  parseForm,
  passwordResetRequestSchema,
  phoneCredentialsFormSchema,
  phoneSignInSchema,
  signInSchema,
  type FormState,
} from '@/lib/auth/schemas';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const NOT_CONFIGURED: FormState = {
  status: 'error',
  message:
    'L’authentification n’est pas encore configurée sur cet environnement.',
};

/**
 * Keeps the session the API opened (ADR-058) in the cookies of the site,
 * as a sign-in with Supabase would.
 */
async function keepSession(
  session: PhoneSessionDto,
): Promise<FormState | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NOT_CONFIGURED;
  const { error } = await supabase.auth.setSession({
    access_token: session.accessToken,
    refresh_token: session.refreshToken,
  });
  if (error) {
    console.error('Session ouverte par l’API refusée', error.code, error);
    return { status: 'error', message: authErrorMessage(error.code) };
  }
  return null;
}

function failure(
  result: Extract<ApiResult<unknown>, { ok: false }>,
): FormState {
  if (result.code === 'API_NOT_CONFIGURED') return NOT_CONFIGURED;
  if (result.code === 'API_UNREACHABLE') {
    return {
      status: 'error',
      message:
        'Connexion impossible pour le moment. Vérifiez internet et réessayez.',
    };
  }
  // The form checked the fields with the same rules as the API; a detail
  // about the number is shown under the field the person typed it in.
  const state = apiErrorState(result);
  if (state.fieldErrors?.phone) {
    state.fieldErrors.number = state.fieldErrors.phone;
  }
  return state;
}

/** Phone number and secret code (ADR-058). */
export async function signIn(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(phoneSignInSchema, formData);
  if (!parsed.ok) return parsed.state;
  const result = await apiPublic<PhoneSessionDto>('/auth/phone/sign-in', {
    method: 'POST',
    body: parsed.data,
  });
  if (!result.ok) return failure(result);
  const refused = await keepSession(result.data);
  if (refused) return refused;
  redirect(safeNextPath(formData.get('next')?.toString()));
}

export async function signUp(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(phoneCredentialsFormSchema, formData);
  if (!parsed.ok) return parsed.state;
  const result = await apiPublic<PhoneSessionDto>('/auth/phone/sign-up', {
    method: 'POST',
    body: parsed.data,
  });
  if (!result.ok) return failure(result);
  const refused = await keepSession(result.data);
  if (refused) return refused;
  redirect(safeNextPath(formData.get('next')?.toString()));
}

/**
 * An account opened with an e-mail, before ADR-058. Each time it signs in
 * this way, it is offered to move to a number and a secret code.
 */
export async function signInWithEmail(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(signInSchema, formData);
  if (!parsed.ok) return parsed.state;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NOT_CONFIGURED;

  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { status: 'error', message: authErrorMessage(error.code) };
  const next = safeNextPath(formData.get('next')?.toString());
  if (!data.user.phone) {
    redirect(`/mon-numero?next=${encodeURIComponent(next)}`);
  }
  redirect(next);
}

/** The signed-in e-mail account takes a number and a code (ADR-058). */
export async function linkPhone(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(phoneCredentialsFormSchema, formData);
  if (!parsed.ok) return parsed.state;
  const session = await getSession();
  if (session.status === 'not-configured') return NOT_CONFIGURED;
  if (session.status === 'signed-out') {
    return {
      status: 'error',
      message: 'Votre session a expiré. Reconnectez-vous avec votre e-mail.',
    };
  }
  const result = await apiAsUser<PhoneSessionDto>(session.accessToken, {
    method: 'POST',
    path: '/auth/phone/link',
    body: parsed.data,
  });
  if (!result.ok) return failure(result);
  const refused = await keepSession(result.data);
  if (refused) return refused;
  redirect(safeNextPath(formData.get('next')?.toString()));
}

export async function requestPasswordReset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(passwordResetRequestSchema, formData);
  if (!parsed.ok) return parsed.state;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NOT_CONFIGURED;

  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    {
      redirectTo: `${siteUrl()}/auth/callback?next=/reinitialiser-mot-de-passe`,
    },
  );
  // Rate limits are worth reporting; anything else gets the neutral answer
  // so the form cannot be used to discover which e-mails have an account.
  if (error?.code?.startsWith('over_')) {
    return { status: 'error', message: authErrorMessage(error.code) };
  }
  return {
    status: 'success',
    message:
      'Si un compte existe pour cette adresse, un lien de réinitialisation vient d’être envoyé.',
  };
}

export async function updatePassword(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(newPasswordSchema, formData);
  if (!parsed.ok) return parsed.state;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NOT_CONFIGURED;

  const { data } = await supabase.auth.getClaims();
  if (!data)
    return {
      status: 'error',
      message: 'Lien expiré. Demandez un nouveau lien de réinitialisation.',
    };

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) return { status: 'error', message: authErrorMessage(error.code) };
  redirect('/espace');
}

/** Signs out; an optional `next` path is kept for the following sign-in. */
export async function signOut(formData?: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(`Déconnexion impossible : ${error.message}`);
  }
  const next = formData?.get('next')?.toString();
  redirect(
    next
      ? `/connexion?next=${encodeURIComponent(safeNextPath(next))}`
      : '/connexion',
  );
}
