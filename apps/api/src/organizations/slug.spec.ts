import { generateSlug } from './slug.js';

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

describe('generateSlug', () => {
  it('strips accents and punctuation and appends a random suffix', () => {
    const slug = generateSlug('Société Générale d’Électricité & Co.');
    expect(slug).toMatch(/^societe-generale-d-electricite-co-[a-f0-9]{6}$/);
  });

  it('matches the database CHECK constraint, including edge cases', () => {
    for (const name of ['A', '!!', 'x'.repeat(200), '  Dakar  Services  ']) {
      const slug = generateSlug(name);
      expect(slug).toMatch(SLUG_RE);
      expect(slug.length).toBeGreaterThanOrEqual(3);
      expect(slug.length).toBeLessThanOrEqual(80);
    }
  });

  it('produces different slugs for the same name', () => {
    expect(generateSlug('Acme')).not.toBe(generateSlug('Acme'));
  });
});
