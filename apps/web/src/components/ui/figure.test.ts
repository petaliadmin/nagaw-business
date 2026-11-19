import { formatAmount } from '@nagaw/shared';
import { describe, expect, it } from 'vitest';
import { compactFigure, fitFigure } from './figure-text';

describe('fitFigure', () => {
  it('lets an amount wrap before its currency, never inside its digits', () => {
    const { text, chars } = fitFigure(formatAmount(1234567, 'XOF'));
    const [digits, currency] = text.split(' ');
    expect(digits).toBe('1 234 567');
    expect(currency).toBe('F CFA');
    expect(chars).toBe(digits?.length);
  });

  it('measures the longest part of a text', () => {
    expect(fitFigure('Non renseigné').chars).toBe('renseigné'.length);
    expect(fitFigure('awa@boutique.sn').chars).toBe(15);
  });

  it('keeps a plain count as it is', () => {
    expect(fitFigure('12')).toEqual({ text: '12', chars: 2 });
    expect(fitFigure('')).toEqual({ text: '', chars: 1 });
  });
});

describe('compactFigure', () => {
  const plain = (v: string | null) => v?.replace(/[  ]/g, ' ');
  it('shortens big amounts as people say them', () => {
    expect(plain(compactFigure(formatAmount(9_987_654_321, 'XOF')))).toBe(
      '9,99 Md F CFA',
    );
    expect(plain(compactFigure(formatAmount(2_421_105, 'XOF')))).toBe(
      '2,42 M F CFA',
    );
    expect(plain(compactFigure(formatAmount(125_000, 'XOF')))).toBe(
      '125 k F CFA',
    );
    expect(plain(compactFigure('-1 500 000 F CFA'))).toBe('-1,5 M F CFA');
  });
  it('leaves alone what is small or not an amount', () => {
    expect(compactFigure(formatAmount(9_500, 'XOF'))).toBeNull();
    expect(compactFigure('12 345 ventes')).toBeNull();
    expect(compactFigure('Non renseigné')).toBeNull();
  });
});
