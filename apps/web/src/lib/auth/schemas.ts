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

export const signInSchema = z.object({
  email,
  password: z.string().min(1, 'Mot de passe requis'),
});

export const signUpSchema = z
  .object({ email, password, confirmation: z.string() })
  .refine((v) => v.password === v.confirmation, {
    path: ['confirmation'],
    message: 'Les mots de passe ne correspondent pas',
  });

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

/** Converts form data to a plain object and validates it. */
export function parseForm<S extends z.ZodType>(
  schema: S,
  formData: FormData,
): { ok: true; data: z.infer<S> } | { ok: false; state: FormState } {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (parsed.success) return { ok: true, data: parsed.data };
  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.join('.') || 'form';
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
