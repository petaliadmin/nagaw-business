import { describe, expect, it } from 'vitest';
import { allowIndexing, serializeJsonLd } from './seo';

describe('allowIndexing', () => {
  it('indexes production and local builds, never previews', () => {
    expect(allowIndexing({ VERCEL_ENV: 'production' })).toBe(true);
    expect(allowIndexing({})).toBe(true);
    expect(allowIndexing({ VERCEL_ENV: 'preview' })).toBe(false);
    expect(allowIndexing({ VERCEL_ENV: 'development' })).toBe(false);
  });
});

describe('serializeJsonLd', () => {
  it('cannot close the script element', () => {
    const out = serializeJsonLd({ name: '</script><script>alert(1)' });
    expect(out).not.toContain('<');
    expect(JSON.parse(out)).toEqual({ name: '</script><script>alert(1)' });
  });
});
