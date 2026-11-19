import {
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js/max';
import { ACCOUNT_COUNTRIES, ACCOUNT_PHONE_RE } from './account.js';

/*
 * Apart from the index (`@nagaw/shared/phone-check`): the telephone plans
 * weigh about 150 kB, for the server only, never in a page (ADR-064).
 */

/**
 * The number of an account from the chosen country and what was typed:
 * `SN` + `77 123 45 67` → `221771234567`. A number typed with `+` or `00`
 * keeps its own code. Null when it is not a number of that country.
 *
 * `valid` (the default, for a new number) follows the country's telephone
 * plan: `77 123 45 67` is a Senegalese mobile, `12 345 67 89` is not.
 * `possible` only checks the length: signing in must never lock out an
 * account whose number a newer plan would not know yet.
 */
export function accountPhone(
  iso: string,
  typed: string,
  check: 'valid' | 'possible' = 'valid',
): string | null {
  const written = typed.trim();
  const digits = written.replace(/\D/g, '');
  if (!digits) return null;
  const international = written.startsWith('+') || digits.startsWith('00');
  if (!international && !ACCOUNT_COUNTRIES.some((c) => c.iso === iso)) {
    return null;
  }
  const parsed = international
    ? parsePhoneNumberFromString(
        `+${digits.startsWith('00') ? digits.slice(2) : digits}`,
      )
    : parsePhoneNumberFromString(written, iso as CountryCode);
  if (!parsed) return null;
  if (check === 'valid' ? !parsed.isValid() : !parsed.isPossible()) {
    return null;
  }
  const phone = parsed.number.slice(1);
  return ACCOUNT_PHONE_RE.test(phone) ? phone : null;
}
