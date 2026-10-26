import { describe, expect, it } from 'vitest';
import { formatWhen, safeNotificationLink, unreadLabel } from './labels';

describe('safeNotificationLink', () => {
  it('keeps the pages of the application', () => {
    expect(safeNotificationLink('/espace/produits/abc')).toBe(
      '/espace/produits/abc',
    );
    expect(safeNotificationLink('/espace/produits?stock=low')).toBe(
      '/espace/produits?stock=low',
    );
    expect(safeNotificationLink('/caisse')).toBe('/caisse');
  });

  it('refuses anything that could leave the site', () => {
    for (const link of [
      'https://evil.example',
      '//evil.example',
      '/espace//evil.example',
      '/espacex',
      '/\\evil.example',
      '',
      null,
      undefined,
    ])
      expect(safeNotificationLink(link)).toBeNull();
  });
});

describe('formatWhen', () => {
  const now = new Date('2026-10-26T12:00:00Z');
  it('says when in everyday words', () => {
    expect(formatWhen('2026-10-26T11:59:30Z', 'Africa/Dakar', now)).toBe(
      'à l’instant',
    );
    expect(formatWhen('2026-10-26T11:55:00Z', 'Africa/Dakar', now)).toBe(
      'il y a 5 minutes',
    );
    expect(formatWhen('2026-10-25T12:00:00Z', 'Africa/Dakar', now)).toBe(
      'hier',
    );
    expect(formatWhen('2026-10-01T12:00:00Z', 'Africa/Dakar', now)).toMatch(
      /1 oct/,
    );
  });
});

describe('unreadLabel', () => {
  it('names the bell for screen readers', () => {
    expect(unreadLabel(0)).toBe('Notifications, aucune non lue');
    expect(unreadLabel(3)).toBe('Notifications, 3 non lues');
  });
});
