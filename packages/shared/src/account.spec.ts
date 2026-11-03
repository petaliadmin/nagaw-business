import { describe, expect, it } from 'vitest';
import {
  accountPhone,
  formatAccountPhone,
  isGuessablePin,
  newPinSchema,
  phoneSignInSchema,
} from './account.js';

describe('accountPhone', () => {
  it('adds the code of the chosen country', () => {
    expect(accountPhone('SN', '77 123 45 67')).toBe('221771234567');
    expect(accountPhone('CI', '07 00 11 22 33')).toBe('2250700112233');
    expect(accountPhone('ML', '76-12-34-56')).toBe('22376123456');
  });

  it('drops the leading 0 where it is not dialled from abroad', () => {
    expect(accountPhone('FR', '06 12 34 56 78')).toBe('33612345678');
    expect(accountPhone('MA', '0612345678')).toBe('212612345678');
  });

  it('keeps the code of a number typed as international', () => {
    expect(accountPhone('SN', '+225 07 00 11 22 33')).toBe('2250700112233');
    expect(accountPhone('SN', '00221 77 123 45 67')).toBe('221771234567');
  });

  it('refuses a number of the wrong length or an unknown country', () => {
    expect(accountPhone('SN', '77 123 45')).toBeNull();
    expect(accountPhone('SN', '77 123 45 67 8')).toBeNull();
    expect(accountPhone('SN', '')).toBeNull();
    expect(accountPhone('XX', '77 123 45 67')).toBeNull();
    expect(accountPhone('SN', '+12')).toBeNull();
  });
});

describe('formatAccountPhone', () => {
  it('writes the number as people read it', () => {
    expect(formatAccountPhone('221771234567')).toBe('+221 77 123 45 67');
    expect(formatAccountPhone('22376123456')).toBe('+223 76 12 34 56');
  });
});

describe('secret code', () => {
  it('is four digits', () => {
    expect(
      phoneSignInSchema.safeParse({ phone: '221771234567', pin: '1234' })
        .success,
    ).toBe(true);
    expect(
      phoneSignInSchema.safeParse({ phone: '221771234567', pin: '123' })
        .success,
    ).toBe(false);
    expect(
      phoneSignInSchema.safeParse({ phone: '221771234567', pin: '12a4' })
        .success,
    ).toBe(false);
  });

  it('refuses a new code anyone would try', () => {
    for (const pin of ['0000', '7777', '1234', '6789', '9876', '3210']) {
      expect(isGuessablePin(pin)).toBe(true);
      expect(newPinSchema.safeParse(pin).success).toBe(false);
    }
    for (const pin of ['1357', '2580', '1243', '9090']) {
      expect(isGuessablePin(pin)).toBe(false);
    }
  });
});
