import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/marketing/site-footer';
import { SiteHeader } from '@/components/marketing/site-header';

/** Conditions and privacy: plain text, readable on a small phone. */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main
        id="contenu"
        className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 text-lg md:py-12 [&_h2]:pt-2 [&_h2]:text-2xl [&_h2]:font-extrabold [&_li]:ml-5 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-2"
      >
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-extrabold md:text-4xl">{title}</h1>
          <p className="text-ink-muted">Mise à jour : {updated}</p>
        </div>
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
