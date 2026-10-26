import { ARTICLES } from '@/content/blog';
import { inlineText, parseMarkdown, type Block } from './markdown';
import { CATEGORIES, type Article, type CategoryKey } from './types';

export function getArticles(): Article[] {
  return ARTICLES;
}

export function getArticle(slug: string): Article | undefined {
  return ARTICLES.find((article) => article.slug === slug);
}

export function articlesInCategory(category: CategoryKey) {
  return ARTICLES.filter((article) => article.category === category);
}

/** Categories that hold at least one article, in display order. */
export function usedCategories() {
  return (Object.keys(CATEGORIES) as CategoryKey[]).filter(
    (key) => articlesInCategory(key).length > 0,
  );
}

export function relatedArticles(article: Article): Article[] {
  return article.related.flatMap((slug) => getArticle(slug) ?? []);
}

function blockText(block: Block): string {
  switch (block.type) {
    case 'heading':
      return block.text;
    case 'paragraph':
    case 'callout':
      return inlineText(block.content);
    case 'list':
      return block.items.map(inlineText).join(' ');
    case 'table':
      return [block.head, ...block.rows].flat().map(inlineText).join(' ');
  }
}

const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** Words of the body, without the summary and the questions. */
export function wordCount(article: Article) {
  return words(parseMarkdown(article.body).map(blockText).join(' '));
}

/** The whole page, at about 200 words a minute on a phone screen. */
export function readingMinutes(article: Article) {
  const extra = [
    ...article.summary,
    ...article.faq.flatMap(({ question, answer }) => [question, answer]),
  ].join(' ');
  return Math.max(1, Math.round((wordCount(article) + words(extra)) / 200));
}

/** Level-2 headings, for the table of contents. */
export function outline(blocks: Block[]) {
  return blocks.flatMap((block) =>
    block.type === 'heading' && block.level === 2
      ? [{ id: block.id, text: block.text }]
      : [],
  );
}

const DATE = new Intl.DateTimeFormat('fr', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatArticleDate(iso: string) {
  return DATE.format(new Date(`${iso}T00:00:00Z`));
}
