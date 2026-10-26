import type { NotificationSeverity } from '@nagaw/shared';

/**
 * A page of the application, or null. Notification links come from the
 * API, which only stores such paths; they are checked again before any
 * redirect so that nothing ever sends a person to another site.
 */
export function safeNotificationLink(
  link: string | null | undefined,
): string | null {
  if (!link || link.length > 300) return null;
  if (!/^\/(espace|caisse)(\/|\?|$)/.test(link)) return null;
  if (link.includes('//') || link.includes('\\')) return null;
  return link;
}

export const SEVERITY_TONES: Record<
  NotificationSeverity,
  { badge: 'brand' | 'warning' | 'danger'; label: string }
> = {
  info: { badge: 'brand', label: 'Information' },
  warning: { badge: 'warning', label: 'À surveiller' },
  danger: { badge: 'danger', label: 'Urgent' },
};

const relative = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });

/** « il y a 5 minutes », « hier », or the date beyond a week. */
export function formatWhen(
  iso: string,
  timeZone: string,
  now = new Date(),
): string {
  const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return 'à l’instant';
  if (abs < 3600) return relative.format(Math.round(seconds / 60), 'minute');
  if (abs < 86_400) return relative.format(Math.round(seconds / 3600), 'hour');
  if (abs < 7 * 86_400)
    return relative.format(Math.round(seconds / 86_400), 'day');
  return new Intl.DateTimeFormat('fr', {
    dateStyle: 'medium',
    timeZone,
  }).format(new Date(iso));
}

/** « 3 notifications non lues », for the bell's accessible name. */
export function unreadLabel(count: number): string {
  if (count === 0) return 'Notifications, aucune non lue';
  return `Notifications, ${count} non lue${count > 1 ? 's' : ''}`;
}
