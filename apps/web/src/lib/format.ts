import { formatAccountPhone } from '@nagaw/shared';
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

/**
 * What the API gives to name a person (ADR-058): `+221771234567` for a
 * phone account, written as people read it; an e-mail stays as it is.
 */
export function formatContact(contact: string): string {
  return /^\+\d+$/.test(contact)
    ? formatAccountPhone(contact.slice(1))
    : contact;
}

/** To whom an invitation was sent: its number, or an older address. */
export function invitationContact(invitation: {
  phone: string | null;
  email: string | null;
}): string {
  if (invitation.phone) return formatAccountPhone(invitation.phone);
  return invitation.email ?? '';
}
