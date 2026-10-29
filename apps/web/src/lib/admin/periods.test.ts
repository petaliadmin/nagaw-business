import { describe, expect, it } from 'vitest';
import { count, dayLabels, monthLabels } from './periods';

describe('platform chart labels', () => {
  it('names a UTC day in full and in short', () => {
    expect(dayLabels('2026-11-03')).toEqual({
      label: 'mardi 3 novembre',
      tick: '3 nov.',
    });
  });

  it('names a month in full and in short', () => {
    expect(monthLabels('2026-01')).toEqual({
      label: 'janvier 2026',
      tick: 'janv. 26',
    });
  });

  it('makes the noun agree with the number', () => {
    expect(count(0, 'boutique', 'boutiques')).toBe('0 boutique');
    expect(count(1, 'boutique', 'boutiques')).toBe('1 boutique');
    // French groups thousands with a narrow no-break space.
    expect(count(1200, 'vente', 'ventes')).toBe('1 200 ventes');
  });
});
