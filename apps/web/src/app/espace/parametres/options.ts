/** Currencies offered first (West and Central Africa, then common ones). */
export const CURRENCIES = [
  'XOF',
  'XAF',
  'EUR',
  'USD',
  'GNF',
  'MAD',
  'NGN',
  'GHS',
];

/**
 * Time zones offered in the settings form, computed on the server so the
 * list is identical on both render passes. Keeps the current value even if
 * the runtime does not list it.
 */
export function timeZoneOptions(current: string): string[] {
  const zones = Intl.supportedValuesOf('timeZone');
  const all = zones.includes('UTC') ? zones : ['UTC', ...zones];
  return all.includes(current) ? all : [current, ...all];
}

export function currencyOptions(current: string): string[] {
  return CURRENCIES.includes(current) ? CURRENCIES : [current, ...CURRENCIES];
}
