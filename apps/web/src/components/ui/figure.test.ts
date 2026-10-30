import { formatAmount } from '@nagaw/shared';
import { describe, expect, it } from 'vitest';
import { fitFigure } from './figure';

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
