'use server';

import { redirect } from 'next/navigation';
import { siteUrl } from '@/lib/env';
import { authErrorMessage } from '@/lib/auth/messages';
import { safeNextPath } from '@/lib/auth/redirect';
import {
  newPasswordSchema,
  parseForm,
  passwordResetRequestSchema,
  signInSchema,
  signUpSchema,
  type FormState,
} from '@/lib/auth/schemas';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const NOT_CONFIGURED: FormState = {
  status: 'error',
  message:
    'L’authentification n’est pas encore configurée sur cet environnement.',
};

export async function signIn(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(signInSchema, formData);
  if (!parsed.ok) return parsed.state;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NOT_CONFIGURED;

  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { status: 'error', message: authErrorMessage(error.code) };
  redirect(safeNextPath(formData.get('next')?.toString()));
}

export async function signUp(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(signUpSchema, formData);
  if (!parsed.ok) return parsed.state;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NOT_CONFIGURED;

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: `${siteUrl()}/auth/callback?next=/espace` },
  });
  if (error) return { status: 'error', message: authErrorMessage(error.code) };
  return {
    status: 'success',
    message:
      'Compte créé. Ouvrez le lien de confirmation envoyé à votre adresse e-mail.',
  };
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

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(`Déconnexion impossible : ${error.message}`);
  }
  redirect('/connexion');
}
