import { describe, expect, it } from 'vitest';
import { installState, isIosSafari } from './install';

const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36';
const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0 Mobile/15E148 Safari/604.1';
const IPAD_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

const env = (overrides: Partial<Parameters<typeof installState>[0]>) => ({
  standalone: false,
  installed: false,
  hasPrompt: false,
  userAgent: ANDROID_CHROME,
  ...overrides,
});

describe('installState', () => {
  it('proposes nothing once installed', () => {
    expect(installState(env({ standalone: true, hasPrompt: true }))).toBe(
      'installed',
    );
    expect(installState(env({ installed: true }))).toBe('installed');
    expect(
      installState(env({ standalone: true, userAgent: IPHONE_SAFARI })),
    ).toBe('installed');
  });

  it('uses the browser’s installation when it offers one', () => {
    expect(installState(env({ hasPrompt: true }))).toBe('prompt');
    expect(installState(env({}))).toBe('unavailable');
  });

  it('explains the two taps on iPhone Safari only', () => {
    expect(installState(env({ userAgent: IPHONE_SAFARI }))).toBe('ios');
    expect(installState(env({ userAgent: IPAD_SAFARI }))).toBe('ios');
    expect(installState(env({ userAgent: IPHONE_CHROME }))).toBe('unavailable');
  });
});

describe('isIosSafari', () => {
  it('recognises Safari on iPhone and iPad, not other browsers', () => {
    expect(isIosSafari(IPHONE_SAFARI)).toBe(true);
    expect(isIosSafari(IPAD_SAFARI)).toBe(true);
    expect(isIosSafari(IPHONE_CHROME)).toBe(false);
    expect(isIosSafari(ANDROID_CHROME)).toBe(false);
  });
});
