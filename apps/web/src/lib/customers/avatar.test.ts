import { describe, expect, it } from 'vitest';
import { avatarTone, initials } from './avatar';

describe('initials', () => {
  it('takes the first and the last name', () => {
    expect(initials('Fatou Ndiaye')).toBe('FN');
    expect(initials(' mame  diarra  bousso ')).toBe('MB');
  });

  it('takes two letters of a single word, accents kept', () => {
    expect(initials('élodie')).toBe('ÉL');
    expect(initials('A')).toBe('A');
    expect(initials('  ')).toBe('?');
  });
});

describe('avatarTone', () => {
  it('gives the same colour to the same customer', () => {
    expect(avatarTone('abc')).toBe(avatarTone('abc'));
    expect(avatarTone('abc')).toMatch(/^bg-\w+-soft text-\w+-ink$/);
  });
});
