import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/env';
import { AI_CRAWLERS, allowIndexing, PRIVATE_PATHS } from '@/lib/seo';

/**
 * Public pages open to every crawler, AI assistants included (GEO); the
 * private app is left out. A preview deployment is closed entirely.
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  if (!allowIndexing(process.env))
    return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: PRIVATE_PATHS },
      { userAgent: AI_CRAWLERS, allow: '/', disallow: PRIVATE_PATHS },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
