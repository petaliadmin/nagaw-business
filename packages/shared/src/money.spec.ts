import { describe, expect, it } from 'vitest';
import {
  amountInputValue,
  currencyDigits,
  formatAmount,
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
