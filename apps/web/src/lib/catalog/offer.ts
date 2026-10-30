import type { ShopOffer } from '@nagaw/shared';

/** The name of what the shop sells, in menus and titles (ADR-047). */
export const CATALOG_TITLES: Record<ShopOffer, string> = {
  products: 'Produits',
  services: 'Services',
  both: 'Produits et services',
};

/** One thing it sells, for « Chercher un… », « Ajouter un… ». */
export const CATALOG_NOUNS: Record<ShopOffer, string> = {
  products: 'produit',
  services: 'service',
  both: 'produit ou un service',
};

export const OFFER_OPTIONS: { value: ShopOffer; label: string }[] = [
  { value: 'products', label: 'Des produits' },
  { value: 'services', label: 'Des services' },
  { value: 'both', label: 'Les deux' },
];
