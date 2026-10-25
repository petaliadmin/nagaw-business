import { describe, expect, it } from 'vitest';
import { NAV_ITEMS, isActive, navItemsFor } from './navigation';

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

  it('hides the invoices from the sellers, who may not open them', () => {
    const hrefs = (role: 'owner' | 'member' | 'viewer') =>
      navItemsFor(role).map((item) => item.href);
    expect(hrefs('owner')).toContain('/espace/factures');
    expect(hrefs('viewer')).toContain('/espace/factures');
    expect(hrefs('member')).not.toContain('/espace/factures');
    expect(hrefs('member')).not.toContain('/espace/statistiques');
    expect(hrefs('member')).not.toContain('/espace/tresorerie');
    expect(hrefs('viewer')).toContain('/espace/tresorerie');
    expect(hrefs('viewer')).toContain('/espace/comptabilite');
    expect(hrefs('member')).not.toContain('/espace/comptabilite');
    expect(hrefs('owner')).toContain('/espace/abonnement');
    expect(hrefs('viewer')).not.toContain('/espace/abonnement');
    expect(hrefs('member')).toContain('/caisse');
  });

  it('only links to pages of the space, and to the offline checkout', () => {
    for (const item of NAV_ITEMS)
      expect(item.href === '/caisse' || item.href.startsWith('/espace')).toBe(
        true,
      );
  });
});
