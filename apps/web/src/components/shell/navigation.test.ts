import type { ShopOffer, ShopSection } from '@nagaw/shared';
import { describe, expect, it } from 'vitest';
import {
  BOTTOM_BAR_MAX,
  NAV_ITEMS,
  activeHref,
  barHrefs,
  bottomBarFor,
  CREDIT_ITEM,
  catalogShortLabel,
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

  it('keeps at most four short entries around « Vendre » in the phone bottom bar', () => {
    const bottom = NAV_ITEMS.filter((item) => item.bottomBar);
    expect(bottom.length).toBeLessThanOrEqual(BOTTOM_BAR_MAX);
    expect(bottom[0]?.href).toBe('/espace');
    // 16 px on 360 px shared by five entries: seven letters at most.
    for (const item of bottom)
      expect((item.shortLabel ?? item.label).length).toBeLessThanOrEqual(7);
  });

  it('puts « Caisse » in the middle of the bottom bar for who may sell', () => {
    const labels = (items: { shortLabel?: string; label: string }[]) =>
      items.map((item) => item.shortLabel ?? item.label);
    const owner = bottomBarFor('owner');
    expect(labels(owner.before)).toEqual(['Accueil', 'Ventes']);
    expect(labels(owner.after)).toEqual(['Stock', 'Argent']);
    expect(owner.sell).toBe(true);
    // A seller does not see the money (ADR-036).
    const seller = bottomBarFor('member');
    expect(labels([...seller.before, ...seller.after])).toEqual([
      'Accueil',
      'Ventes',
      'Stock',
    ]);
    expect(seller.sell).toBe(true);
    expect(bottomBarFor('viewer').sell).toBe(false);
  });

  it('marks the closest entry of the bottom bar', () => {
    const bar = bottomBarFor('owner');
    const active = (path: string) =>
      activeHref([...bar.before, ...bar.after], path);
    expect(active('/espace/tresorerie/depenses')).toBe('/espace/tresorerie');
    expect(active('/espace/produits/fournisseurs')).toBe('/espace/produits');
    expect(active('/espace/ventes/7')).toBe('/espace/ventes');
    expect(active('/espace/clients')).toBeNull();
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
      '/espace/parametres',
      '/caisse',
    ])
      expect(parentPath(path), path).toBeNull();
    // Opened from the « Paramètres » menu (ADR-063).
    expect(parentPath('/espace/journal')).toBe('/espace/parametres');
    expect(parentPath('/espace/equipe')).toBe('/espace/parametres');
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
      '/espace/factures/liste',
    );
    expect(parentPath('/espace/factures/devis/nouveau')).toBe(
      '/espace/factures/devis',
    );
  });

  it('follows what the shop sells', () => {
    const catalog = (offer: ShopOffer) =>
      navItemsFor('owner', offer).find((i) => i.href === '/espace/produits');
    expect(catalog('both')?.label).toBe('Produits et services');
    expect(catalog('both')?.shortLabel).toBe('Stock');
    expect(catalog('products')?.shortLabel).toBe('Stock');
    expect(catalog('services')?.shortLabel).toBe('Services');
    const hrefs = (offer: ShopOffer) =>
      navItemsFor('owner', offer).map((item) => item.href);
    expect(hrefs('services')).not.toContain('/espace/produits/fournisseurs');
    expect(hrefs('products')).toContain('/espace/produits/fournisseurs');
  });

  it('hides the parts the shop hides, never the daily pages (ADR-067)', () => {
    const simple = {
      offer: 'products' as const,
      hiddenSections: [
        'customers',
        'documents',
        'suppliers',
        'reports',
        'team',
      ] as const,
      countsStockByDefault: false,
    };
    const hrefs = navItemsFor('owner', {
      ...simple,
      hiddenSections: [...simple.hiddenSections],
    }).map((item) => item.href);
    expect(hrefs).toEqual([
      '/espace',
      '/espace/ventes',
      '/espace/produits',
      '/espace/tresorerie/depenses',
      '/espace/tresorerie',
      '/espace/parametres',
    ]);
    // Nothing counted, sold on credit: « Crédit » takes the catalogue's place.
    const bar = bottomBarFor('owner', {
      ...simple,
      hiddenSections: [...simple.hiddenSections],
    });
    expect(
      [...bar.before, ...bar.after].map((i) => i.shortLabel ?? i.label),
    ).toEqual(['Accueil', 'Ventes', 'Crédit', 'Argent']);
  });

  it('fills the bottom bar with what the shop opens every day (ADR-067)', () => {
    const bar = (
      offer: ShopOffer,
      hiddenSections: ShopSection[],
      countsStockByDefault: boolean,
      role: TestRole = 'owner',
    ) => {
      const { before, after } = bottomBarFor(role, {
        offer,
        hiddenSections,
        countsStockByDefault,
      });
      return [...before, ...after].map((i) => i.shortLabel ?? i.label);
    };
    // The shop of the other maquettes: unchanged.
    expect(bar('products', [], true)).toEqual([
      'Accueil',
      'Ventes',
      'Stock',
      'Argent',
    ]);
    // Nothing counted, no credit: the catalogue keeps its place.
    expect(bar('products', ['credit'], false)).toEqual([
      'Accueil',
      'Ventes',
      'Produits',
      'Argent',
    ]);
    // A workshop that quotes and invoices.
    expect(bar('services', [], true)).toEqual([
      'Accueil',
      'Factures',
      'Services',
      'Argent',
    ]);
    expect(bar('services', ['documents', 'customers'], true)).toEqual([
      'Accueil',
      'Ventes',
      'Services',
      'Argent',
    ]);
    // Products and services, stock counted.
    expect(bar('both', ['team'], true)).toEqual([
      'Accueil',
      'Ventes',
      'Stock',
      'Argent',
    ]);
    // A seller never gains the money (ADR-036).
    expect(bar('products', [], false, 'member')).not.toContain('Argent');
  });

  it('keeps in the Menu what leaves the bar', () => {
    const display = {
      offer: 'services' as const,
      hiddenSections: [],
      countsStockByDefault: true,
    };
    expect(barHrefs('owner', display)).not.toContain('/espace/ventes');
    expect(navItemsFor('owner', display).map((i) => i.href)).toContain(
      '/espace/ventes',
    );
    const lit = bottomBarFor('owner', {
      offer: 'products',
      hiddenSections: [],
      countsStockByDefault: false,
    });
    expect(activeHref([...lit.before, ...lit.after], '/espace/clients/7')).toBe(
      CREDIT_ITEM.href,
    );
  });

  it('names the catalogue after what the shop counts', () => {
    const shop = (offer: ShopOffer, countsStockByDefault: boolean) => ({
      offer,
      hiddenSections: [],
      countsStockByDefault,
    });
    expect(catalogShortLabel(shop('products', true))).toBe('Stock');
    expect(catalogShortLabel(shop('products', false))).toBe('Produits');
    expect(catalogShortLabel(shop('both', false))).toBe('Produits');
    expect(catalogShortLabel(shop('services', false))).toBe('Services');
    expect(catalogShortLabel(shop('services', true))).toBe('Services');
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
