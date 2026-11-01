/** Senegal: the default of a shop, changed in its settings. */
export const DEFAULT_PHONE_COUNTRY_CODE = '221';

/** Shortest national number in the countries served. */
const MIN_NATIONAL_DIGITS = 8;

/**
 * A number as WhatsApp links want it: digits only, country code first
 * (`77 123 45 67` → `221771234567`). Null when it cannot be a real number:
 * the link then lets the person choose the contact.
 */
export function internationalPhone(
  phone: string | null | undefined,
  countryCode: string = DEFAULT_PHONE_COUNTRY_CODE,
): string | null {
  const written = (phone ?? '').trim();
  const digits = written.replace(/\D/g, '');
  if (digits.length < MIN_NATIONAL_DIGITS) return null;
  if (written.startsWith('+')) return digits;
  if (digits.startsWith('00')) return digits.slice(2);
  // Already written with the code of the country, without the +.
  if (
    digits.startsWith(countryCode) &&
    digits.length >= countryCode.length + MIN_NATIONAL_DIGITS
  )
    return digits;
  return `${countryCode}${digits}`;
}
