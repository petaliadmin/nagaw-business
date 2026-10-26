import { ChevronDown, ChevronRight, CircleCheck, Clock } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArticleBody } from '@/components/blog/article-body';
import { ArticleCard } from '@/components/blog/article-card';
import { JsonLd } from '@/components/json-ld';
import { SiteFooter } from '@/components/marketing/site-footer';
import { SiteHeader } from '@/components/marketing/site-header';
import { ButtonLink } from '@/components/ui/button-link';
import {
  formatArticleDate,
  getArticle,
  getArticles,
  outline,
  readingMinutes,
  relatedArticles,
  wordCount,
} from '@/lib/blog/articles';
import { parseMarkdown } from '@/lib/blog/markdown';
import { CATEGORIES } from '@/lib/blog/types';
import { siteUrl } from '@/lib/env';
import {
  blogPosting,
  breadcrumb,
  faqPage,
  graph,
  organization,
} from '@/lib/structured-data';

export function generateStaticParams() {
  return getArticles().map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<'/blog/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return {};
  const path = `/blog/${article.slug}`;
  return {
    title: `${article.seoTitle} | Nagaw Business`,
    description: article.description,
    keywords: article.keywords,
    alternates: { canonical: path },
    authors: [{ name: 'L’équipe Nagaw Business', url: '/' }],
    openGraph: {
      type: 'article',
      url: path,
      title: article.title,
      description: article.description,
      publishedTime: article.published,
      modifiedTime: article.updated,
      section: CATEGORIES[article.category].label,
      tags: article.keywords,
    },
    twitter: { title: article.title, description: article.description },
  };
}

export default async function ArticlePage({
  params,
}: PageProps<'/blog/[slug]'>) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  const base = siteUrl();
  const blocks = parseMarkdown(article.body);
  const sections = outline(blocks);
  const category = CATEGORIES[article.category];
  const updated = formatArticleDate(article.updated);

  return (
    <div className="flex flex-1 flex-col">
      <JsonLd
        data={graph(
          organization(base),
          blogPosting(base, article, wordCount(article)),
          breadcrumb(base, [
            ['Accueil', '/'],
            ['Guides', '/blog'],
            [article.title, `/blog/${article.slug}`],
          ]),
          faqPage(article.faq),
        )}
      />
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-8 md:py-12">
        <nav aria-label="Fil d’Ariane">
          <ol className="flex flex-wrap items-center gap-1 text-base">
            <li className="flex items-center gap-1">
              <Link
                href="/"
                className="inline-flex min-h-12 items-center font-semibold text-brand-ink underline underline-offset-4"
              >
                Accueil
              </Link>
              <ChevronRight aria-hidden className="size-4 text-ink-muted" />
            </li>
            <li className="flex items-center gap-1">
              <Link
                href="/blog"
                className="inline-flex min-h-12 items-center font-semibold text-brand-ink underline underline-offset-4"
              >
                Guides
              </Link>
              <ChevronRight aria-hidden className="size-4 text-ink-muted" />
            </li>
            <li aria-current="page" className="line-clamp-1 text-ink-muted">
              {article.title}
            </li>
          </ol>
        </nav>

        <header className="flex flex-col gap-4">
          <p
            className={`self-start rounded-full px-3 py-1 text-base font-bold ${category.badge}`}
          >
            {category.label}
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight md:text-5xl">
            {article.title}
          </h1>
          <p className="text-xl text-ink-muted">{article.description}</p>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-base text-ink-muted">
            <span>
              Par <strong className="text-ink">l’équipe Nagaw Business</strong>
            </span>
            <span>
              Mis à jour le <time dateTime={article.updated}>{updated}</time>
            </span>
            <span className="flex items-center gap-1">
              <Clock aria-hidden className="size-5" />
              {readingMinutes(article)} min de lecture
            </span>
          </p>
        </header>

        <section
          aria-labelledby="en-bref"
          className="flex flex-col gap-3 rounded-3xl border-2 border-sales-strong bg-sales-soft p-5"
        >
          <h2 id="en-bref" className="text-xl font-extrabold text-sales-ink">
            En bref
          </h2>
          <ul className="flex flex-col gap-2">
            {article.summary.map((point) => (
              <li key={point} className="flex items-start gap-2 text-lg">
                <CircleCheck
                  aria-hidden
                  className="mt-1 size-5 shrink-0 text-sales-ink"
                />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </section>

        <nav
          aria-labelledby="sommaire"
          className="flex flex-col gap-2 rounded-3xl bg-surface-muted p-5"
        >
          <h2 id="sommaire" className="text-lg font-extrabold">
            Dans cet article
          </h2>
          <ol className="flex flex-col">
            {sections.map(({ id, text }) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="inline-flex min-h-12 items-center font-semibold text-brand-ink underline underline-offset-4"
                >
                  {text}
                </a>
              </li>
            ))}
            <li>
              <a
                href="#questions-frequentes"
                className="inline-flex min-h-12 items-center font-semibold text-brand-ink underline underline-offset-4"
              >
                Questions fréquentes
              </a>
            </li>
          </ol>
        </nav>

        <ArticleBody blocks={blocks} />

        <section
          aria-labelledby="questions-frequentes"
          className="flex flex-col gap-3"
        >
          <h2
            id="questions-frequentes"
            className="mt-6 scroll-mt-20 text-2xl font-extrabold md:text-3xl"
          >
            Questions fréquentes
          </h2>
          <ul className="flex flex-col gap-3">
            {article.faq.map(({ question, answer }) => (
              <li key={question}>
                <details className="group rounded-2xl border border-line bg-surface">
                  <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 p-4 text-lg font-bold [&::-webkit-details-marker]:hidden">
                    <span className="flex-1">{question}</span>
                    <ChevronDown
                      aria-hidden
                      className="size-6 shrink-0 text-ink-muted transition-transform group-open:rotate-180 motion-reduce:transition-none"
                    />
                  </summary>
                  <p className="px-4 pb-4 text-lg">{answer}</p>
                </details>
              </li>
            ))}
          </ul>
        </section>

        <aside
          aria-labelledby="essayer"
          className="flex flex-col items-start gap-4 rounded-3xl bg-brand-strong p-6 text-white"
        >
          <h2 id="essayer" className="text-2xl font-extrabold">
            Faites-le avec Nagaw Business
          </h2>
          <p className="text-lg">
            Caisse qui marche sans internet, stock, crédit des clients, caisses
            Wave et Orange Money, factures et comptabilité SYSCOHADA, depuis
            votre téléphone. Gratuit pour commencer, sans carte bancaire.
          </p>
          <ButtonLink
            href="/inscription"
            variant="secondary"
            className="text-lg"
          >
            Créer ma boutique gratuitement
          </ButtonLink>
        </aside>
      </main>

      <section
        aria-labelledby="a-lire"
        className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pb-16"
      >
        <h2 id="a-lire" className="text-2xl font-extrabold">
          À lire aussi
        </h2>
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {relatedArticles(article).map((related) => (
            <li key={related.slug}>
              <ArticleCard article={related} />
            </li>
          ))}
        </ul>
      </section>
      <SiteFooter />
    </div>
  );
}
