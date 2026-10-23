import { describe, expect, it } from 'vitest';
import { resolveSiteUrl } from './site-url';

describe('resolveSiteUrl', () => {
  it('prefers SITE_URL, without trailing slash', () => {
    expect(
      resolveSiteUrl({
        SITE_URL: 'https://app.test/',
        VERCEL_BRANCH_URL: 'branch.vercel.app',
      }),
    ).toBe('https://app.test');
  });

  it('falls back to the Vercel branch URL, then the deployment URL', () => {
    expect(
      resolveSiteUrl({
        VERCEL_BRANCH_URL: 'web-git-x.vercel.app',
        VERCEL_URL: 'web-abc.vercel.app',
      }),
    ).toBe('https://web-git-x.vercel.app');
    expect(resolveSiteUrl({ VERCEL_URL: 'web-abc.vercel.app' })).toBe(
      'https://web-abc.vercel.app',
    );
    expect(resolveSiteUrl({})).toBe('http://localhost:3000');
  });
});
