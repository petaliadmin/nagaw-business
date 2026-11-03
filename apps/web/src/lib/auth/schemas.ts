import {
  accountPhone,
  invitableRoleSchema,
  newPinSchema,
  pinSchema,
} from '@nagaw/shared';
import { z } from 'zod';

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Adresse e-mail invalide'));
const password = z
  .string()
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
  .max(72, 'Le mot de passe ne peut pas dépasser 72 caractères');

/** Sign-in of an account still on its e-mail (before ADR-058). */
export const signInSchema = z.object({
  email,
  password: z.string().min(1, 'Mot de passe requis'),
});

const phoneFields = {
  /** ISO code of the country chosen in the list (Senegal by default). */
  country: z.string().min(1, 'Choisissez un pays'),
  number: z.string().trim().min(1, 'Numéro de téléphone requis'),
};

/** The account number from the country and what was typed. */
function withPhone<T extends { country: string; number: string }>(
  value: T,
  ctx: z.RefinementCtx,
) {
  const phone = accountPhone(value.country, value.number);
  if (!phone) {
    ctx.addIssue({
      code: 'custom',
      path: ['number'],
      message: 'Numéro de téléphone invalide pour ce pays',
    });
    return z.NEVER;
  }
  const rest: Partial<T> = { ...value };
  delete rest.country;
  delete rest.number;
  return { ...(rest as Omit<T, 'country' | 'number'>), phone };
}

const confirmed = <T extends { pin: string; confirmation: string }>(v: T) =>
  v.pin === v.confirmation;
const NOT_CONFIRMED = {
  path: ['confirmation'],
  message: 'Les deux codes ne sont pas pareils',
};

/** Phone number and secret code (ADR-058). */
export const phoneSignInSchema = z
  .object({ ...phoneFields, pin: pinSchema })
  .transform(withPhone);

/** A new account, or an e-mail account taking a number: code chosen twice. */
export const phoneCredentialsFormSchema = z
  .object({ ...phoneFields, pin: newPinSchema, confirmation: z.string() })
  .refine(confirmed, NOT_CONFIRMED)
  .transform(withPhone)
  .transform(({ phone, pin }) => ({ phone, pin }));

/** An invitation to join the shop, bound to the number (ADR-058). */
export const invitationFormSchema = z
  .object({ ...phoneFields, role: invitableRoleSchema })
  .strict()
  .transform(withPhone);

/** A new code given by the platform administrator. */
export const newPinFormSchema = z
  .object({ pin: newPinSchema, confirmation: z.string() })
  .refine(confirmed, NOT_CONFIRMED)
  .transform(({ pin }) => ({ pin }));

export const passwordResetRequestSchema = z.object({ email });

export const newPasswordSchema = z
  .object({ password, confirmation: z.string() })
  .refine((v) => v.password === v.confirmation, {
    path: ['confirmation'],
    message: 'Les mots de passe ne correspondent pas',
  });

export type FormState = {
  status: 'idle' | 'error' | 'success';
  message?: string;
  fieldErrors?: Record<string, string>;
};

export const initialFormState: FormState = { status: 'idle' };

/**
 * Form fields as a plain object, without the hidden `$ACTION_*` fields React
 * adds for progressive enhancement (strict schemas would reject them).
 */
export function formFields(
  formData: FormData,
): Record<string, FormDataEntryValue> {
  return Object.fromEntries(
    [...formData.entries()].filter(([key]) => !key.startsWith('$ACTION')),
  );
}

/** Converts form data to a plain object and validates it. */
export function parseForm<S extends z.ZodType>(
  schema: S,
  formData: FormData,
): { ok: true; data: z.infer<S> } | { ok: false; state: FormState } {
  return parseValues(schema, formFields(formData));
}

/**
 * Validates already-assembled values (for forms with repeated or nested
 * fields). `stripPrefix` maps nested error paths back to field names.
 */
export function parseValues<S extends z.ZodType>(
  schema: S,
  values: unknown,
  stripPrefix?: string,
): { ok: true; data: z.infer<S> } | { ok: false; state: FormState } {
  const parsed = schema.safeParse(values);
  if (parsed.success) return { ok: true, data: parsed.data };
  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    let key = issue.path.join('.') || 'form';
    if (stripPrefix && key.startsWith(stripPrefix)) {
      key = key.slice(stripPrefix.length);
    }
    fieldErrors[key] ??= issue.message;
  }
  return {
    ok: false,
    state: {
      status: 'error',
      message: 'Vérifiez les champs indiqués.',
      fieldErrors,
    },
  };
}
