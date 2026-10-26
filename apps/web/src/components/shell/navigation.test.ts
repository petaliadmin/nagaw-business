import { describe, expect, it } from 'vitest';
import {
  NAV_ITEMS,
  activeHref,
  isActive,
  navItemsFor,
  sectionTabsFor,
  type Section,
} from './navigation';

type TestRole = 'owner' | 'member' | 'viewer';

describe('navigation', () => {
  it('follows the owner’s order', () => {
    expect(NAV_ITEMS.map((item) => item.label)).toEqual([
      'Tableau de bord',
      'Ventes',
      'Stock / Produits',
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
    expect(active('/espace/factures/7')).toBe('/espace/ventes');
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
    expect(tabs('ventes', 'owner')).toContain('/espace/factures');
    expect(tabs('ventes', 'viewer')).toContain('/espace/factures');
    // Sellers read invoices and prepare quotes (ADR-036).
    expect(tabs('ventes', 'member')).toContain('/espace/factures');
    expect(tabs('rapports', 'viewer')).toContain('/espace/comptabilite');
    expect(tabs('rapports', 'member')).toEqual([]);
    expect(tabs('parametres', 'owner')).toContain('/espace/abonnement');
    expect(tabs('parametres', 'viewer')).not.toContain('/espace/abonnement');
  });

  it('only links to pages of the space', () => {
    for (const item of NAV_ITEMS)
      expect(item.href.startsWith('/espace')).toBe(true);
  });
});
