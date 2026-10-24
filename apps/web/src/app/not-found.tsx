import { SearchX } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button-link';
import { Logo } from '@/components/ui/logo';

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
      <Logo href="/" />
      <div className="flex flex-col items-start gap-4 rounded-2xl border border-line bg-surface p-5 shadow-sm md:p-8">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-brand-soft text-brand-ink">
          <SearchX aria-hidden className="size-9" />
        </span>
        <h1 className="text-3xl font-extrabold">Page introuvable</h1>
        <p className="text-ink-muted">
          Cette adresse ne correspond à aucune page. Elle a peut-être été
          déplacée, ou le lien est incomplet.
        </p>
        <ButtonLink href="/espace">Revenir à l’accueil</ButtonLink>
      </div>
    </main>
  );
}
