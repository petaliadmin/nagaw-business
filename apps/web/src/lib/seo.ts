/** Brand name, as search engines and AI assistants should cite it. */
export const SITE_NAME = 'Nagaw Business';

/** One-sentence answer to "what is Nagaw Business?", reused everywhere. */
export const SITE_SUMMARY =
  'Nagaw Business est une application de gestion de boutique en français, pensée pour les commerçants d’Afrique de l’Ouest : caisse qui marche sans internet, stock, crédit des clients, caisses Wave et Orange Money, factures, statistiques et comptabilité SYSCOHADA, depuis un téléphone ou un ordinateur.';

/**
 * Private areas of the app: never useful in a search result, and behind a
 * session anyway. Listed in robots.txt so that crawlers do not waste time.
 */
export const PRIVATE_PATHS = [
  '/espace',
  '/admin',
  '/caisse',
  '/auth',
  '/invitation',
  '/lien-invalide',
  '/reinitialiser-mot-de-passe',
  '/mot-de-passe-oublie',
  '/hors-ligne',
];

/**
 * AI crawlers named in robots.txt (GEO): they are welcome on the public
 * pages, and kept out of the private ones like any other crawler.
 */
export const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'Bingbot',
];

/**
 * Whether this deployment may be indexed: Vercel previews must never compete
 * with the production site in search results.
 */
export function allowIndexing(env: Record<string, string | undefined>) {
  return !env.VERCEL_ENV || env.VERCEL_ENV === 'production';
}

/**
 * JSON-LD payload for a `<script type="application/ld+json">`: `<` is
 * escaped so that no string can close the script element.
 */
export function serializeJsonLd(data: unknown) {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
