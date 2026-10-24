import { describe, expect, it } from 'vitest';
import { NAV_ITEMS, isActive } from './navigation';

describe('navigation', () => {
  it('marks only the overview on /espace', () => {
    const active = NAV_ITEMS.filter((item) => isActive(item.href, '/espace'));
    expect(active.map((item) => item.href)).toEqual(['/espace']);
  });

  it('marks a section and its sub-pages, never a sibling with a shared prefix', () => {
    expect(isActive('/espace/equipe', '/espace/equipe')).toBe(true);
    expect(isActive('/espace/equipe', '/espace/equipe/invitations')).toBe(true);
    expect(isActive('/espace/equipe', '/espace/equipes')).toBe(false);
    expect(isActive('/espace', '/espace/equipe')).toBe(false);
  });

  it('keeps at most three entries in the phone bottom bar, next to « Plus »', () => {
    const bottom = NAV_ITEMS.filter((item) => item.bottomBar);
    expect(bottom.length).toBeLessThanOrEqual(3);
    expect(bottom[0]?.href).toBe('/espace');
  });

  it('only links to pages of the space, and to the offline checkout', () => {
    for (const item of NAV_ITEMS)
      expect(item.href === '/caisse' || item.href.startsWith('/espace')).toBe(
        true,
      );
  });
});
