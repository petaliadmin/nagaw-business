import { describe, expect, it } from 'vitest';
import { previousPeriod, resolvePeriod } from './period';

describe('periods', () => {
  const today = '2026-03-05';
  it('names days, weeks and months from the shop’s day', () => {
    expect(resolvePeriod({}, today)).toEqual({
      key: 'jour',
      from: today,
      to: today,
    });
    expect(resolvePeriod({ periode: 'hier' }, today)).toMatchObject({
      from: '2026-03-04',
      to: '2026-03-04',
    });
    expect(resolvePeriod({ periode: '7j' }, today)).toMatchObject({
      from: '2026-02-27',
      to: today,
    });
    expect(resolvePeriod({ periode: 'mois' }, today)).toMatchObject({
      from: '2026-03-01',
      to: today,
    });
    expect(resolvePeriod({ periode: 'mois-precedent' }, today)).toMatchObject({
      from: '2026-02-01',
      to: '2026-02-28',
    });
    expect(
      resolvePeriod({ periode: 'mois-precedent' }, '2026-01-10'),
    ).toMatchObject({ from: '2025-12-01', to: '2025-12-31' });
  });

  it('takes dates chosen by hand, in order, and ignores the rest', () => {
    expect(
      resolvePeriod({ du: '2026-01-01', au: '2026-01-31' }, today),
    ).toEqual({
      key: 'perso',
      from: '2026-01-01',
      to: '2026-01-31',
    });
    expect(
      resolvePeriod({ du: '2026-02-01', au: '2026-01-01' }, today).key,
    ).toBe('jour');
    expect(resolvePeriod({ periode: 'inconnue' }, today, 'mois').key).toBe(
      'mois',
    );
  });

  it('compares with the same days of the month before, or the days just before', () => {
    expect(previousPeriod('2026-03-01', '2026-03-05')).toEqual({
      from: '2026-02-01',
      to: '2026-02-05',
    });
    expect(previousPeriod('2026-03-01', '2026-03-31')).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    });
    expect(previousPeriod('2026-01-01', '2026-01-10')).toEqual({
      from: '2025-12-01',
      to: '2025-12-10',
    });
    expect(previousPeriod('2026-03-05', '2026-03-05')).toEqual({
      from: '2026-03-04',
      to: '2026-03-04',
    });
    expect(previousPeriod('2026-02-27', '2026-03-05')).toEqual({
      from: '2026-02-20',
      to: '2026-02-26',
    });
  });
});
