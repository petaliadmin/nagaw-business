import { describe, expect, it } from 'vitest';
import { currencyOptions, timeZoneOptions } from './options';

describe('settings options', () => {
  it('lists IANA time zones including UTC and the current value', () => {
    const zones = timeZoneOptions('Africa/Dakar');
    expect(zones).toContain('UTC');
    expect(zones).toContain('Africa/Dakar');
    expect(timeZoneOptions('Legacy/Zone')[0]).toBe('Legacy/Zone');
  });

  it('keeps an unlisted current currency selectable', () => {
    expect(currencyOptions('XOF')[0]).toBe('XOF');
    expect(currencyOptions('CHF')[0]).toBe('CHF');
  });
});
