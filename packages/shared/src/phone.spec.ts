import { describe, expect, it } from 'vitest';
import { internationalPhone } from './phone.js';

describe('internationalPhone', () => {
  it('adds the code of the country to a local number', () => {
    expect(internationalPhone('77 123 45 67')).toBe('221771234567');
    expect(internationalPhone('77-123-45-67')).toBe('221771234567');
  });

  it('keeps a number already international', () => {
    expect(internationalPhone('+221 77 123 45 67')).toBe('221771234567');
    expect(internationalPhone('00221 77 123 45 67')).toBe('221771234567');
    expect(internationalPhone('221 77 123 45 67')).toBe('221771234567');
    expect(internationalPhone('+33 6 12 34 56 78')).toBe('33612345678');
  });

  it('follows the country of the shop', () => {
    expect(internationalPhone('07 00 11 22 33', '225')).toBe('2250700112233');
    expect(internationalPhone('76 12 34 56', '223')).toBe('22376123456');
  });

  it('gives nothing for what cannot be a number', () => {
    expect(internationalPhone('')).toBeNull();
    expect(internationalPhone(null)).toBeNull();
    expect(internationalPhone('12 34')).toBeNull();
  });
});
