/**
 * Amounts are integers in the minor unit of the shop's currency (ADR-023):
 * XOF has none, EUR has cents. Shared by the web (input, display) and the
 * API (validation), so both agree on every amount.
 */

/** Number of decimals of a currency (XOF: 0, EUR: 2). */
export function currencyDigits(currency: string): number {
  return (
    new Intl.NumberFormat('fr', {
      style: 'currency',
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 0
  );
}

/** Largest amount accepted, in minor units (mirrors the SQL checks). */
export const MAX_AMOUNT = 1_000_000_000_000;

/**
 * Parses what a person types (« 12 500 », « 1500,50 », « 1.5 ») into minor
 * units. Returns null when the text is not a valid amount for the currency.
 */
export function parseAmount(text: string, currency: string): number | null {
  const digits = currencyDigits(currency);
  const compact = text.replace(/[\s  ]/g, '').replace(',', '.');
  const match = /^(\d+)(?:\.(\d+))?$/.exec(compact);
  if (!match) return null;
  const [, whole, fraction = ''] = match;
  if (fraction.length > digits) return null;
  const minor = Number(whole + fraction.padEnd(digits, '0'));
  return Number.isSafeInteger(minor) && minor <= MAX_AMOUNT ? minor : null;
}

/** Display: `12 500 FCFA`, `15,50 €`. */
export function formatAmount(minor: number, currency: string): string {
  const digits = currencyDigits(currency);
  return new Intl.NumberFormat('fr', {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(minor / 10 ** digits);
}

/** Value to put back in an input field (no grouping): `12500`, `15,50`. */
export function amountInputValue(minor: number, currency: string): string {
  const digits = currencyDigits(currency);
  if (digits === 0) return String(minor);
  return (minor / 10 ** digits).toFixed(digits).replace('.', ',');
}
