export const CATEGORIES = {
  gestion: {
    label: 'Gérer sa boutique',
    badge: 'bg-brand-soft text-brand-ink',
  },
  ventes: { label: 'Ventes et caisse', badge: 'bg-sales-soft text-sales-ink' },
  stock: { label: 'Stock', badge: 'bg-stock-soft text-stock-ink' },
  argent: {
    label: 'Argent et trésorerie',
    badge: 'bg-stats-soft text-stats-ink',
  },
  factures: {
    label: 'Factures et comptabilité',
    badge: 'bg-invoices-soft text-invoices-ink',
  },
  metiers: {
    label: 'Par type de boutique',
    badge: 'bg-accounting-soft text-accounting-ink',
  },
} as const;

export type CategoryKey = keyof typeof CATEGORIES;

/**
 * A blog article. Copy rule, as on the home page: every promise about the
 * app is a delivered feature (IMPLEMENTATION_STATUS.md), every number in an
 * example is presented as an example, and no price of an offer is written
 * here (prices are in base, ADR-029).
 */
export interface Article {
  slug: string;
  /** The page heading. */
  title: string;
  /** The `<title>`, without the brand (added by the page). */
  seoTitle: string;
  /** Meta description: what the reader gets, 120 to 160 characters. */
  description: string;
  category: CategoryKey;
  /** Search phrases the article answers; the first is the main one. */
  keywords: string[];
  /** ISO dates (YYYY-MM-DD). */
  published: string;
  updated: string;
  /** "En bref": the answer in a few lines, for readers and AI assistants. */
  summary: string[];
  /** Markdown subset of `markdown.ts`. */
  body: string;
  faq: { question: string; answer: string }[];
  /** Slugs of related articles. */
  related: string[];
}
