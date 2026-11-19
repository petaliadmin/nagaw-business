import { describe, expect, it } from 'vitest';
import {
  amountInputValue,
  currencyDigits,
  formatAmount,
  formatCompactAmount,
  parseAmount,
} from './money.js';

const nbsp = (text: string) => text.replace(/[  ]/g, ' ');

describe('money', () => {
  it('knows that XOF has no decimals and EUR has two', () => {
    expect(currencyDigits('XOF')).toBe(0);
    expect(currencyDigits('EUR')).toBe(2);
  });

  it('parses what people type, with spaces and commas', () => {
    expect(parseAmount('12 500', 'XOF')).toBe(12500);
    expect(parseAmount('12 500', 'XOF')).toBe(12500);
    expect(parseAmount('1500,50', 'EUR')).toBe(150050);
    expect(parseAmount('1.5', 'EUR')).toBe(150);
    expect(parseAmount('0', 'XOF')).toBe(0);
  });

  it('refuses decimals the currency does not have, and anything else', () => {
    expect(parseAmount('12,5', 'XOF')).toBeNull();
    expect(parseAmount('1,005', 'EUR')).toBeNull();
    expect(parseAmount('-5', 'XOF')).toBeNull();
    expect(parseAmount('12 500 F', 'XOF')).toBeNull();
    expect(parseAmount('', 'XOF')).toBeNull();
    expect(parseAmount('99999999999999', 'XOF')).toBeNull();
  });

  it('formats for display and for input fields', () => {
    expect(nbsp(formatAmount(12500, 'XOF'))).toBe('12 500 F CFA');
    expect(nbsp(formatAmount(150050, 'EUR'))).toBe('1 500,50 €');
    expect(amountInputValue(12500, 'XOF')).toBe('12500');
    expect(amountInputValue(150050, 'EUR')).toBe('1500,50');
  });
});

describe('formatCompactAmount', () => {
  it('shortens as people say it: k, M, Md', () => {
    const plain = (v: string) => v.replace(/[\u00a0\u202f]/g, ' ');
    expect(plain(formatCompactAmount(999, 'XOF'))).toBe('999 F CFA');
    expect(plain(formatCompactAmount(12_500, 'XOF'))).toBe('12,5 k F CFA');
    expect(plain(formatCompactAmount(2_421_105, 'XOF'))).toBe('2,42 M F CFA');
    expect(plain(formatCompactAmount(9_987_654_321, 'XOF'))).toBe(
      '9,99 Md F CFA',
    );
    expect(plain(formatCompactAmount(123_456_750, 'EUR'))).toBe('1,23 M €');
  });
});
