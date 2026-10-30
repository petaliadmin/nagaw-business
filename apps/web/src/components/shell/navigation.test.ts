import type { ShopOffer } from '@nagaw/shared';
import { describe, expect, it } from 'vitest';
import {
  NAV_ITEMS,
  activeHref,
  canGoBack,
  isActive,
  navItemsFor,
  parentPath,
  sectionTabsFor,
  trackPath,
  type Section,
} from './navigation';

type TestRole = 'owner' | 'member' | 'viewer';

describe('navigation', () => {
  it('follows the owner’s order', () => {
    expect(NAV_ITEMS.map((item) => item.label)).toEqual([
      'Tableau de bord',
      'Ventes',
      'Produits et services',
      'Factures / Devis',
      'Clients',
      'Fournisseurs',
      'Dépenses',
      'Trésorerie / Caisse',
      'Rapports / Statistiques',
      'Paramètres',
    ]);
  });

  it('marks only the overview on /espace', () => {
    expect(activeHref(NAV_ITEMS, '/espace')).toBe('/espace');
  });

  it('marks a section and its sub-pages, never a sibling with a shared prefix', () => {
    expect(isActive('/espace/clients', '/espace/clients')).toBe(true);
    expect(isActive('/espace/clients', '/espace/clients/42')).toBe(true);
    expect(isActive('/espace/clients', '/espace/clientsx')).toBe(false);
    expect(isActive('/espace', '/espace/clients')).toBe(false);
  });

  it('marks the most specific entry', () => {
    const active = (path: string) => activeHref(NAV_ITEMS, path);
    expect(active('/espace/produits')).toBe('/espace/produits');
    expect(active('/espace/produits/12')).toBe('/espace/produits');
    expect(active('/espace/produits/fournisseurs')).toBe(
      '/espace/produits/fournisseurs',
    );
    expect(active('/espace/tresorerie')).toBe('/espace/tresorerie');
    expect(active('/espace/tresorerie/depenses')).toBe(
      '/espace/tresorerie/depenses',
    );
  });

  it('marks the section of a page shown as a tab', () => {
    const active = (path: string) => activeHref(NAV_ITEMS, path);
    expect(active('/espace/factures/7')).toBe('/espace/factures');
    expect(active('/espace/factures/devis/7')).toBe('/espace/factures');
    expect(active('/espace/comptabilite')).toBe('/espace/statistiques');
    expect(active('/espace/equipe')).toBe('/espace/parametres');
    expect(active('/espace/journal')).toBe('/espace/parametres');
    expect(active('/espace/abonnement')).toBe('/espace/parametres');
  });

  it('keeps at most three short entries in the phone bottom bar', () => {
    const bottom = NAV_ITEMS.filter((item) => item.bottomBar);
    expect(bottom.length).toBeLessThanOrEqual(3);
    expect(bottom[0]?.href).toBe('/espace');
    for (const item of bottom)
      expect((item.shortLabel ?? item.label).length).toBeLessThanOrEqual(8);
  });

  it('hides the money and the reports from the sellers', () => {
    const hrefs = (role: TestRole) =>
      navItemsFor(role).map((item) => item.href);
    expect(hrefs('member')).not.toContain('/espace/statistiques');
    expect(hrefs('member')).not.toContain('/espace/tresorerie');
    expect(hrefs('member')).not.toContain('/espace/tresorerie/depenses');
    expect(hrefs('viewer')).toContain('/espace/tresorerie');
    expect(hrefs('member')).toContain('/espace/ventes');
    expect(hrefs('member')).toContain('/espace/produits/fournisseurs');
  });

  it('shows each tab only to the roles that may open it', () => {
    const tabs = (section: Section, role: TestRole) =>
      sectionTabsFor(section, role).map((tab) => tab.href);
    expect(tabs('factures', 'owner')).toContain('/espace/factures');
    expect(tabs('factures', 'member')).not.toContain('/espace/factures');
    expect(tabs('factures', 'viewer')).toContain('/espace/factures');
    // Sellers read invoices and prepare quotes (ADR-036).
    expect(tabs('factures', 'member')).toContain('/espace/factures/liste');
    expect(tabs('rapports', 'viewer')).toContain('/espace/comptabilite');
    expect(tabs('rapports', 'member')).toEqual([]);
    expect(tabs('parametres', 'owner')).toContain('/espace/abonnement');
    expect(tabs('parametres', 'viewer')).not.toContain('/espace/abonnement');
  });

  it('offers « Retour » everywhere but on the pages of the menu', () => {
    for (const path of [
      '/espace',
      '/espace/ventes',
      '/espace/produits',
      '/espace/produits/fournisseurs',
      '/espace/factures',
      '/espace/factures/liste',
      '/espace/factures/devis',
      '/espace/factures/nouveau',
      '/espace/journal',
      '/caisse',
    ])
      expect(parentPath(path), path).toBeNull();
    expect(parentPath('/espace/produits/12')).toBe('/espace/produits');
    expect(parentPath('/espace/produits/12/modifier')).toBe(
      '/espace/produits/12',
    );
    expect(parentPath('/espace/ventes/7')).toBe('/espace/ventes');
    expect(parentPath('/espace/notifications')).toBe('/espace');
    expect(parentPath('/espace/factures/devis/7')).toBe(
      '/espace/factures/devis',
    );
    expect(parentPath('/espace/factures/7')).toBe('/espace/factures/liste');
    expect(parentPath('/espace/factures/nouvelle')).toBe(
      '/espace/factures/nouveau',
    );
    expect(parentPath('/espace/factures/devis/nouveau')).toBe(
      '/espace/factures/nouveau',
    );
  });

  it('follows what the shop sells', () => {
    const catalog = (offer: ShopOffer) =>
      navItemsFor('owner', offer).find((i) => i.href === '/espace/produits');
    expect(catalog('both')?.label).toBe('Produits et services');
    expect(catalog('products')?.shortLabel).toBe('Produits');
    expect(catalog('services')?.shortLabel).toBe('Services');
    const hrefs = (offer: ShopOffer) =>
      navItemsFor('owner', offer).map((item) => item.href);
    expect(hrefs('services')).not.toContain('/espace/produits/fournisseurs');
    expect(hrefs('products')).toContain('/espace/produits/fournisseurs');
  });

  it('follows the pages seen, forward and back', () => {
    let trail = trackPath([], '/espace/produits');
    trail = trackPath(trail, '/espace/produits/12');
    expect(trail).toEqual(['/espace/produits', '/espace/produits/12']);
    expect(trackPath(trail, '/espace/produits/12')).toEqual(trail);
    expect(trackPath(trail, '/espace/produits')).toEqual(['/espace/produits']);
  });

  it('goes back to the page seen, never to a form already sent', () => {
    expect(canGoBack(['/espace/clients/1'])).toBe(false);
    expect(canGoBack(['/espace/clients/1', '/espace/factures/2'])).toBe(true);
    for (const form of [
      '/espace/produits/nouveau',
      '/espace/factures/nouvelle',
      '/espace/produits/12/modifier',
    ])
      expect(canGoBack([form, '/espace/produits/12'])).toBe(false);
  });

  it('offers « Retour » in the administration too', () => {
    expect(parentPath('/admin/boutiques/7')).toBe('/admin/boutiques');
    expect(parentPath('/admin/boutiques')).toBeNull();
  });

  it('only links to pages of the space', () => {
    for (const item of NAV_ITEMS)
      expect(item.href.startsWith('/espace')).toBe(true);
  });
});
