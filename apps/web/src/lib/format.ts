/** Date and time in French, in the organization's time zone. */
export function formatDateTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('fr', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(iso));
}

export function formatDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('fr', {
    dateStyle: 'long',
    timeZone,
  }).format(new Date(iso));
}

/** Today in the given time zone, as YYYY-MM-DD (same rule as the API). */
export function todayIn(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
}

/** A calendar date (YYYY-MM-DD) in French, without time-zone shift. */
export function formatCalendarDate(date: string): string {
  return formatDate(date, 'UTC');
}
