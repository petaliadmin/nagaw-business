import type { Article } from './blog/types';
import { SITE_NAME, SITE_SUMMARY } from './seo';

// schema.org descriptions of the public pages (JSON-LD). Every node has a
// stable `@id`, so that search engines and AI assistants link the article,
// its publisher and the product into one entity.

export const organizationId = (base: string) => `${base}/#organisation`;
export const websiteId = (base: string) => `${base}/#site`;
export const appId = (base: string) => `${base}/#application`;

export function organization(base: string) {
  return {
    '@type': 'Organization',
    '@id': organizationId(base),
    name: SITE_NAME,
    url: `${base}/`,
    logo: {
      '@type': 'ImageObject',
      url: `${base}/icons/icon-512.png`,
      width: 512,
      height: 512,
    },
    description: SITE_SUMMARY,
  };
}

export function website(base: string) {
  return {
    '@type': 'WebSite',
    '@id': websiteId(base),
    name: SITE_NAME,
    url: `${base}/`,
    inLanguage: 'fr',
    publisher: { '@id': organizationId(base) },
  };
}

/** The app itself; offers are added by the caller from the live grid. */
export function softwareApplication(base: string) {
  return {
    '@type': 'SoftwareApplication',
    '@id': appId(base),
    name: SITE_NAME,
    url: `${base}/`,
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Logiciel de caisse et de gestion de boutique',
    operatingSystem: 'Android, iOS, Windows, macOS (navigateur web)',
    inLanguage: 'fr',
    description: SITE_SUMMARY,
    featureList: [
      'Caisse qui fonctionne sans internet',
      'Gestion du stock, entrées, pertes et inventaire',
      'Crédit des clients',
      'Caisses espèces, Wave, Orange Money, Free Money et banque',
      'Clôture de caisse',
      'Factures, devis et avoirs en PDF',
      'Statistiques, marge et bénéfice estimé',
      'Comptabilité SYSCOHADA (système minimal de trésorerie)',
      'Rôles pour les vendeurs et historique des actions',
    ],
    publisher: { '@id': organizationId(base) },
  };
}

export function breadcrumb(
  base: string,
  items: [name: string, path: string][],
) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, path], index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name,
      item: `${base}${path}`,
    })),
  };
}

export function faqPage(faq: { question: string; answer: string }[]) {
  return {
    '@type': 'FAQPage',
    mainEntity: faq.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  };
}

export function blogPosting(base: string, article: Article, words: number) {
  const url = `${base}/blog/${article.slug}`;
  return {
    '@type': 'BlogPosting',
    '@id': `${url}#article`,
    headline: article.title,
    description: article.description,
    url,
    mainEntityOfPage: url,
    image: `${url}/opengraph-image`,
    datePublished: article.published,
    dateModified: article.updated,
    inLanguage: 'fr',
    keywords: article.keywords.join(', '),
    wordCount: words,
    abstract: article.summary.join(' '),
    author: { '@id': organizationId(base) },
    publisher: { '@id': organizationId(base) },
    isPartOf: { '@id': `${base}/blog#blog` },
    about: { '@id': appId(base) },
  };
}

/** Wraps nodes in one JSON-LD document. */
export function graph(...nodes: object[]) {
  return { '@context': 'https://schema.org', '@graph': nodes };
}
