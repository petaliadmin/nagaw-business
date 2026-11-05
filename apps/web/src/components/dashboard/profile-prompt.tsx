import { Sparkles } from 'lucide-react';
import { skipProfile } from '@/app/espace/profil/actions';
import { ButtonLink } from '@/components/ui/button-link';
import { buttonClasses } from '@/components/ui/button-styles';
import { Card } from '@/components/ui/card';

/**
 * Asked once to the shops that have not answered, the existing ones
 * included (ADR-062). « Vendre » stays the main action of the dashboard.
 */
export function ProfilePrompt({ organizationId }: { organizationId: string }) {
  return (
    <Card
      title="Adaptez l’application"
      titleId="profile-prompt"
      icon={Sparkles}
    >
      <p className="text-base">
        Dites-nous votre activité : le menu n’affichera que ce qui vous sert.
        Deux minutes. Rien n’est effacé, tout se change dans Paramètres.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href="/espace/profil" variant="secondary">
          Répondre aux questions
        </ButtonLink>
        <form action={skipProfile}>
          <input type="hidden" name="organizationId" value={organizationId} />
          <button
            type="submit"
            className={buttonClasses('secondary', 'w-full sm:w-auto')}
          >
            Plus tard
          </button>
        </form>
      </div>
    </Card>
  );
}
