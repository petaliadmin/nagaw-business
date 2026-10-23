/** Today in the given time zone, as YYYY-MM-DD. */
export function today(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
}
