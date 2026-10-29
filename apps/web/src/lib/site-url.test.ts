import { describe, expect, it } from 'vitest';
import { PRODUCTION_SITE_URL, resolveSiteUrl } from './site-url';

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

  it('always uses the canonical domain in production', () => {
    expect(PRODUCTION_SITE_URL).toBe('https://www.naagaw.com');
    expect(
      resolveSiteUrl({
        VERCEL_ENV: 'production',
        SITE_URL: 'https://nagaw-web-petalia.vercel.app',
        VERCEL_URL: 'nagaw-web-abc.vercel.app',
      }),
    ).toBe('https://www.naagaw.com');
    // A preview keeps its own address.
    expect(
      resolveSiteUrl({
        VERCEL_ENV: 'preview',
        VERCEL_BRANCH_URL: 'web-git-x.vercel.app',
      }),
    ).toBe('https://web-git-x.vercel.app');
  });
});
