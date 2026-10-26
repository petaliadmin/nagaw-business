import { describe, expect, it } from 'vitest';
import { getArticle, getArticles, wordCount } from './articles';
import { parseMarkdown } from './markdown';

// Guards the published content: a broken internal link, a duplicate slug or
// a meta description that search engines would truncate fails the build.
const articles = getArticles();

describe('blog articles', () => {
  it('have unique slugs made of plain URL characters', () => {
    const slugs = articles.map((article) => article.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it.each(articles.map((article) => [article.slug, article]))(
    '%s has search-friendly metadata',
    (_slug, article) => {
      expect(article.seoTitle.length).toBeLessThanOrEqual(60);
      expect(article.description.length).toBeGreaterThanOrEqual(110);
      expect(article.description.length).toBeLessThanOrEqual(165);
      expect(article.keywords.length).toBeGreaterThanOrEqual(3);
      expect(article.summary.length).toBeGreaterThanOrEqual(3);
      expect(article.faq.length).toBeGreaterThanOrEqual(3);
      expect(article.updated >= article.published).toBe(true);
    },
  );

  it.each(articles.map((article) => [article.slug, article]))(
    '%s is substantial and well structured',
    (_slug, article) => {
      const blocks = parseMarkdown(article.body);
      // The body alone; the summary and the questions come on top of it.
      expect(wordCount(article)).toBeGreaterThanOrEqual(550);
      expect(
        blocks.filter((b) => b.type === 'heading' && b.level === 2).length,
      ).toBeGreaterThanOrEqual(4);
      // A list line inside a paragraph means a list the parser did not see.
      for (const block of blocks)
        if (block.type === 'paragraph')
          expect(block.content[0]?.text ?? '').not.toMatch(/^(- |\d+\. )/);
    },
  );

  it.each(articles.map((article) => [article.slug, article]))(
    '%s links only to pages that exist',
    (_slug, article) => {
      for (const slug of article.related) {
        expect(getArticle(slug), slug).toBeDefined();
        expect(slug).not.toBe(article.slug);
      }
      const links = parseMarkdown(article.body).flatMap((block) => {
        const content =
          block.type === 'paragraph' || block.type === 'callout'
            ? block.content
            : block.type === 'list'
              ? block.items.flat()
              : block.type === 'table'
                ? [...block.head, ...block.rows.flat()].flat()
                : [];
        return content.flatMap((part) =>
          part.type === 'link' ? [part.href] : [],
        );
      });
      expect(links.length).toBeGreaterThanOrEqual(3);
      for (const href of links) {
        const blog = /^\/blog\/([a-z0-9-]+)$/.exec(href);
        if (blog) expect(getArticle(blog[1]), href).toBeDefined();
        else expect(['/', '/inscription', '/#tarifs']).toContain(href);
      }
    },
  );
});
