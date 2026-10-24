import { SearchX } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button-link';

/**
 * Inside the space: a product (or page) that does not exist — or belongs
 * to another shop, which the API answers the same way.
 */
export default function WorkspaceNotFound() {
  return (
    <div className="flex flex-col items-start gap-4">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-brand-soft text-brand-ink">
        <SearchX aria-hidden className="size-9" />
      </span>
      <h1 className="text-2xl font-extrabold md:text-3xl">Introuvable</h1>
      <p className="text-ink-muted">
        Ce que vous cherchez n’existe pas dans cette boutique, ou a été retiré.
      </p>
      <ButtonLink href="/espace">Revenir à l’accueil</ButtonLink>
    </div>
  );
}
