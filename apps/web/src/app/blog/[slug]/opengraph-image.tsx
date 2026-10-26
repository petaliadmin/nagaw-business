import { ImageResponse } from 'next/og';
import { getArticle, getArticles } from '@/lib/blog/articles';
import { CATEGORIES } from '@/lib/blog/types';
import { OG_SIZE, OgCard } from '@/lib/og-card';

export const alt = 'Guide Nagaw Business pour gérer sa boutique';
export const size = OG_SIZE;
export const contentType = 'image/png';

export function generateStaticParams() {
  return getArticles().map(({ slug }) => ({ slug }));
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticle(slug);
  return new ImageResponse(
    <OgCard
      eyebrow={article ? CATEGORIES[article.category].label : 'Guides'}
      title={article?.title ?? 'Guides pour gérer sa boutique'}
    />,
    size,
  );
}
