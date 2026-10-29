/** Labels of the platform charts; days and months are UTC (ADR-041). */

const at = (iso: string) => new Date(`${iso}T12:00:00Z`);

const longDay = new Intl.DateTimeFormat('fr', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});
const shortDay = new Intl.DateTimeFormat('fr', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const longMonth = new Intl.DateTimeFormat('fr', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const shortMonth = new Intl.DateTimeFormat('fr', {
  month: 'short',
  year: '2-digit',
  timeZone: 'UTC',
});

/** `2026-11-03` → « mardi 3 novembre » and « 3 nov. ». */
export function dayLabels(day: string) {
  return { label: longDay.format(at(day)), tick: shortDay.format(at(day)) };
}

/** `2026-11` → « novembre 2026 » and « nov. 26 ». */
export function monthLabels(month: string) {
  const date = at(`${month}-15`);
  return { label: longMonth.format(date), tick: shortMonth.format(date) };
}

/** A whole number of people or shops, with the noun agreeing. */
export function count(n: number, one: string, many: string) {
  return `${new Intl.NumberFormat('fr').format(n)} ${n > 1 ? many : one}`;
}
