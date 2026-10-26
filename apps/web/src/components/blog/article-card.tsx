import { Clock } from 'lucide-react';
import Link from 'next/link';
import { readingMinutes } from '@/lib/blog/articles';
import { CATEGORIES, type Article } from '@/lib/blog/types';

/** A guide in a list: the whole card is one link, named by the title. */
export function ArticleCard({
  article,
  headingLevel = 3,
}: {
  article: Article;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const category = CATEGORIES[article.category];
  return (
    <article className="relative flex h-full flex-col gap-3 rounded-3xl border border-line bg-surface p-5 shadow-sm focus-within:outline-2 focus-within:outline-focus hover:border-brand-strong">
      <p
        className={`self-start rounded-full px-3 py-1 text-base font-bold ${category.badge}`}
      >
        {category.label}
      </p>
      <Heading className="text-xl font-extrabold">
        <Link
          href={`/blog/${article.slug}`}
          className="after:absolute after:inset-0 after:rounded-3xl focus-visible:outline-none"
        >
          {article.title}
        </Link>
      </Heading>
      <p className="flex-1 text-base text-ink-muted">{article.description}</p>
      <p className="flex items-center gap-2 text-base font-semibold text-ink-muted">
        <Clock aria-hidden className="size-5" />
        {readingMinutes(article)} min de lecture
      </p>
    </article>
  );
}
