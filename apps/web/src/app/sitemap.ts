import type { MetadataRoute } from 'next';
import { getArticles } from '@/lib/blog/articles';
import { siteUrl } from '@/lib/env';

/** The public pages: home, guides and sign-up. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const articles = getArticles();
  const lastGuide = articles
    .map((article) => article.updated)
    .sort()
    .at(-1);
  return [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    {
      url: `${base}/blog`,
      lastModified: lastGuide,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    ...articles.map((article) => ({
      url: `${base}/blog/${article.slug}`,
      lastModified: article.updated,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    { url: `${base}/inscription`, changeFrequency: 'yearly', priority: 0.5 },
  ];
}
