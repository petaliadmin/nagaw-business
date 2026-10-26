import { ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArticleCard } from '@/components/blog/article-card';
import { JsonLd } from '@/components/json-ld';
import { SiteFooter } from '@/components/marketing/site-footer';
import { SiteHeader } from '@/components/marketing/site-header';
import { ButtonLink } from '@/components/ui/button-link';
import {
  articlesInCategory,
  getArticles,
  usedCategories,
} from '@/lib/blog/articles';
import { CATEGORIES } from '@/lib/blog/types';
import { siteUrl } from '@/lib/env';
import {
  breadcrumb,
  graph,
  organization,
  organizationId,
  website,
} from '@/lib/structured-data';

const TITLE = 'Guides pour gérer sa boutique';
const DESCRIPTION =
  'Stock, caisse, crédit des clients, Wave et Orange Money, marge, factures, TVA et SYSCOHADA : des guides simples et gratuits pour les commerçants d’Afrique de l’Ouest.';

export const metadata: Metadata = {
  title: `${TITLE} | Nagaw Business`,
  description: DESCRIPTION,
  alternates: { canonical: '/blog' },
  openGraph: {
    type: 'website',
    url: '/blog',
    title: `${TITLE} | Nagaw Business`,
    description: DESCRIPTION,
  },
};

export default function BlogIndex() {
  const base = siteUrl();
  const [guide, ...others] = getArticles();
  return (
    <div className="flex flex-1 flex-col">
      <JsonLd
        data={graph(
          organization(base),
          website(base),
          {
            '@type': 'Blog',
            '@id': `${base}/blog#blog`,
            name: TITLE,
            description: DESCRIPTION,
            url: `${base}/blog`,
            inLanguage: 'fr',
            publisher: { '@id': organizationId(base) },
            blogPost: getArticles().map((article) => ({
              '@type': 'BlogPosting',
              '@id': `${base}/blog/${article.slug}#article`,
              headline: article.title,
              url: `${base}/blog/${article.slug}`,
              datePublished: article.published,
              dateModified: article.updated,
            })),
          },
          breadcrumb(base, [
            ['Accueil', '/'],
            ['Guides', '/blog'],
          ]),
        )}
      />
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <section className="bg-brand-soft">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-12 md:py-16">
            <p className="text-base font-bold tracking-wide text-brand-ink uppercase">
              Guides gratuits
            </p>
            <h1 className="text-4xl font-extrabold tracking-tight text-brand-ink md:text-5xl">
              {TITLE}
            </h1>
            <p className="max-w-3xl text-xl">
              Des conseils concrets, en mots simples, pour vendre, tenir son
              stock, compter son argent et préparer sa comptabilité. Écrits pour
              les commerçants d’Afrique de l’Ouest, avec des exemples en F CFA.
            </p>
          </div>
        </section>

        <section
          aria-labelledby="start-title"
          className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pt-12"
        >
          <h2 id="start-title" className="text-2xl font-extrabold">
            Pour commencer
          </h2>
          <article className="relative flex flex-col gap-3 rounded-3xl bg-brand-strong p-6 text-white focus-within:outline-2 focus-within:outline-focus md:p-8">
            <h3 className="text-2xl font-extrabold md:text-3xl">
              <Link
                href={`/blog/${guide.slug}`}
                className="after:absolute after:inset-0 after:rounded-3xl focus-visible:outline-none"
              >
                {guide.title}
              </Link>
            </h3>
            <p className="max-w-3xl text-lg">{guide.description}</p>
            <p className="flex items-center gap-2 font-bold">
              Lire le guide <ArrowRight aria-hidden className="size-5" />
            </p>
          </article>
        </section>

        {usedCategories().map((key) => {
          const articles = articlesInCategory(key).filter((article) =>
            others.includes(article),
          );
          if (articles.length === 0) return null;
          return (
            <section
              key={key}
              aria-labelledby={`categorie-${key}`}
              className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pt-12"
            >
              <h2 id={`categorie-${key}`} className="text-2xl font-extrabold">
                {CATEGORIES[key].label}
              </h2>
              <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {articles.map((article) => (
                  <li key={article.slug}>
                    <ArticleCard article={article} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        <section className="px-4 py-16">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-5 rounded-3xl bg-sales-strong p-6 text-white md:flex-row md:items-center md:justify-between md:p-10">
            <div className="flex flex-col gap-2">
              <h2 className="text-3xl font-extrabold">
                Mettez ces conseils en pratique
              </h2>
              <p className="text-lg">
                Nagaw Business fait les calculs pour vous : stock, caisse,
                crédit, marge et comptabilité. Gratuit pour commencer.
              </p>
            </div>
            <ButtonLink
              href="/inscription"
              variant="secondary"
              className="shrink-0 text-lg"
            >
              Créer ma boutique gratuitement
            </ButtonLink>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
