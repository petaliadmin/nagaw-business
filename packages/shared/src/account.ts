import { z } from 'zod';

/**
 * Countries offered when signing in with a phone number (ADR-058). Senegal
 * comes first and is the default. `nationalDigits`: length of a number
 * written without the code, when known; `dropTrunkZero`: the leading 0 of a
 * national number is not dialled from abroad.
 */
export const ACCOUNT_COUNTRIES = [
  { iso: 'SN', name: 'Sénégal', code: '221', nationalDigits: 9 },
  { iso: 'CI', name: 'Côte d’Ivoire', code: '225', nationalDigits: 10 },
  { iso: 'ML', name: 'Mali', code: '223', nationalDigits: 8 },
  { iso: 'BF', name: 'Burkina Faso', code: '226', nationalDigits: 8 },
  { iso: 'GN', name: 'Guinée', code: '224' },
  { iso: 'MR', name: 'Mauritanie', code: '222' },
  { iso: 'GM', name: 'Gambie', code: '220' },
  { iso: 'GW', name: 'Guinée-Bissau', code: '245' },
  { iso: 'NE', name: 'Niger', code: '227' },
  { iso: 'TG', name: 'Togo', code: '228' },
  { iso: 'BJ', name: 'Bénin', code: '229' },
  { iso: 'CM', name: 'Cameroun', code: '237' },
  { iso: 'GA', name: 'Gabon', code: '241' },
  { iso: 'CG', name: 'Congo', code: '242' },
  { iso: 'CD', name: 'RD Congo', code: '243' },
  { iso: 'MA', name: 'Maroc', code: '212', dropTrunkZero: true },
  {
    iso: 'FR',
    name: 'France',
    code: '33',
    nationalDigits: 9,
    dropTrunkZero: true,
  },
] as const satisfies readonly {
  iso: string;
  name: string;
  code: string;
  nationalDigits?: number;
  dropTrunkZero?: boolean;
}[];

export type AccountCountry = (typeof ACCOUNT_COUNTRIES)[number];
export const DEFAULT_ACCOUNT_COUNTRY: AccountCountry['iso'] = 'SN';

/** International digits without `+`, as Supabase stores a phone. */
export const ACCOUNT_PHONE_RE = /^[1-9][0-9]{7,14}$/;

/**
 * The number of an account from the chosen country and what was typed:
 * `SN` + `77 123 45 67` → `221771234567`. A number typed with `+` or `00`
 * keeps its own code. Null when it cannot be a number of that country.
 */
export function accountPhone(iso: string, typed: string): string | null {
  const written = typed.trim();
  let digits = written.replace(/\D/g, '');
  if (written.startsWith('+') || digits.startsWith('00')) {
    if (digits.startsWith('00')) digits = digits.slice(2);
    return ACCOUNT_PHONE_RE.test(digits) ? digits : null;
  }
  const country = ACCOUNT_COUNTRIES.find((c) => c.iso === iso);
  if (!country) return null;
  if ('dropTrunkZero' in country && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  const expected = 'nationalDigits' in country ? country.nationalDigits : null;
  if (expected !== null ? digits.length !== expected : digits.length < 7) {
    return null;
  }
  const phone = `${country.code}${digits}`;
  return ACCOUNT_PHONE_RE.test(phone) ? phone : null;
}

/** `221771234567` → `+221 77 123 45 67` when the country is known. */
export function formatAccountPhone(phone: string): string {
  const country = ACCOUNT_COUNTRIES.find((c) => phone.startsWith(c.code));
  if (!country) return `+${phone}`;
  const national = phone.slice(country.code.length);
  const groups =
    national.length === 9
      ? [
          national.slice(0, 2),
          national.slice(2, 5),
          national.slice(5, 7),
          national.slice(7),
        ]
      : (national.match(/.{1,2}/g) ?? [national]);
  return `+${country.code} ${groups.join(' ')}`;
}

export const accountPhoneSchema = z
  .string({ error: 'Numéro de téléphone invalide' })
  .regex(ACCOUNT_PHONE_RE, 'Numéro de téléphone invalide');

/** The secret code: 4 digits. */
export const pinSchema = z
  .string({ error: 'Le code secret doit contenir 4 chiffres' })
  .regex(/^\d{4}$/, 'Le code secret doit contenir 4 chiffres');

/**
 * Codes refused when one is chosen: the same digit four times, or four
 * digits that follow each other (`1234`, `9876`). Anyone would try them.
 */
export function isGuessablePin(pin: string): boolean {
  const d = [...pin].map(Number);
  const step = d[1]! - d[0]!;
  const regular = d.every((v, i) => i === 0 || v - d[i - 1]! === step);
  return regular && Math.abs(step) <= 1;
}

export const newPinSchema = pinSchema.refine((pin) => !isGuessablePin(pin), {
  message: 'Ce code est trop facile à deviner. Choisissez-en un autre.',
});

export const phoneSignInSchema = z
  .object({ phone: accountPhoneSchema, pin: pinSchema })
  .strict();
export type PhoneSignInInput = z.infer<typeof phoneSignInSchema>;

/** Creating an account, or giving a number to an e-mail account. */
export const phoneCredentialsSchema = z
  .object({ phone: accountPhoneSchema, pin: newPinSchema })
  .strict();
export type PhoneCredentialsInput = z.infer<typeof phoneCredentialsSchema>;

/** A new code given by the platform administrator (ADR-058). */
export const adminSetPinSchema = z.object({ pin: newPinSchema }).strict();
export type AdminSetPinInput = z.infer<typeof adminSetPinSchema>;

/** A Supabase session, opened by the API, that the web app keeps. */
export interface PhoneSessionDto {
  accessToken: string;
  refreshToken: string;
}
