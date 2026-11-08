import { describe, expect, it } from 'vitest';
import { cashSuggestions } from './cash';

describe('cashSuggestions', () => {
  it('starts with the exact total, then the notes a customer hands over', () => {
    expect(cashSuggestions(1_750, 'XOF')).toEqual([
      1_750, 2_000, 5_000, 10_000,
    ]);
    expect(cashSuggestions(3_200, 'XOF')).toEqual([
      3_200, 4_000, 5_000, 10_000,
    ]);
    expect(cashSuggestions(300, 'XOF')).toEqual([300, 500, 1_000, 2_000]);
  });

  it('never suggests the total again, nor small notes for a big amount', () => {
    expect(cashSuggestions(5_000, 'XOF')).toEqual([5_000, 10_000]);
    expect(cashSuggestions(10_000, 'XOF')).toEqual([10_000]);
    expect(cashSuggestions(47_300, 'XOF')).toEqual([47_300, 50_000]);
  });

  it('gives the exact total only for a currency with decimals, and nothing to pay', () => {
    expect(cashSuggestions(1_999, 'EUR')).toEqual([1_999]);
    expect(cashSuggestions(0, 'XOF')).toEqual([]);
  });
});
