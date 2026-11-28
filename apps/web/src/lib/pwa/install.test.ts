import { describe, expect, it } from 'vitest';
import { installState, iosGuide, isIosSafari } from './install';

const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36';
const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0 Mobile/15E148 Safari/604.1';
const IPHONE_SAFARI_26 =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const IPHONE_EDGE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 EdgiOS/141.0 Mobile/15E148 Safari/605.1.15';
const IPHONE_INSTAGRAM =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0';
const IPHONE_FACEBOOK =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/480.0.0]';
/** iPadOS Safari, as a desktop Mac: only the touch screen tells. */
const IPAD_DESKTOP =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15';
const MAC_SAFARI = IPAD_DESKTOP;
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

  it('explains the taps on every iPhone and iPad browser', () => {
    expect(installState(env({ userAgent: IPHONE_SAFARI }))).toBe('ios');
    expect(installState(env({ userAgent: IPAD_SAFARI }))).toBe('ios');
    expect(installState(env({ userAgent: IPHONE_CHROME }))).toBe('ios');
    expect(installState(env({ userAgent: IPHONE_INSTAGRAM }))).toBe('ios');
    expect(installState(env({ userAgent: IPAD_DESKTOP, touchPoints: 5 }))).toBe(
      'ios',
    );
    // A Mac has no touch screen: nothing to explain.
    expect(installState(env({ userAgent: MAC_SAFARI }))).toBe('unavailable');
  });
});

describe('iosGuide', () => {
  it('tells Safari 26 from older Safari, by Safari’s own version', () => {
    expect(iosGuide(IPHONE_SAFARI_26)).toBe('safari-26');
    expect(iosGuide(IPHONE_SAFARI)).toBe('safari');
    expect(iosGuide(IPAD_DESKTOP, 5)).toBe('safari-26');
  });

  it('guides other browsers, and sends apps’ browsers to Safari', () => {
    expect(iosGuide(IPHONE_CHROME)).toBe('browser');
    expect(iosGuide(IPHONE_EDGE)).toBe('browser');
    expect(iosGuide(IPHONE_INSTAGRAM)).toBe('in-app');
    expect(iosGuide(IPHONE_FACEBOOK)).toBe('in-app');
    expect(iosGuide(ANDROID_CHROME)).toBeNull();
    expect(iosGuide(MAC_SAFARI)).toBeNull();
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
