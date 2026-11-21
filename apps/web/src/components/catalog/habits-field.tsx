import {
  FileText,
  HandCoins,
  Package,
  Users,
  type LucideIcon,
} from 'lucide-react';

/** The four questions of « Comment travaillez-vous ? » (ADR-067). */
const QUESTIONS: {
  name: 'credit' | 'stock' | 'documents' | 'team';
  label: string;
  hint: string;
  icon: LucideIcon;
}[] = [
  {
    name: 'credit',
    label: 'Vendez-vous à crédit ?',
    hint: '« Ils vous doivent » sur l’Accueil',
    icon: HandCoins,
  },
  {
    name: 'stock',
    label: 'Comptez-vous ce qu’il vous reste ?',
    hint: 'Le stock baisse à chaque vente',
    icon: Package,
  },
  {
    name: 'documents',
    label: 'Faites-vous des factures ou des devis ?',
    hint: 'Avec votre nom et votre numéro',
    icon: FileText,
  },
  {
    name: 'team',
    label: 'Quelqu’un vend avec vous ?',
    hint: 'Un vendeur, la famille',
    icon: Users,
  },
];

/**
 * « Comment travaillez-vous ? »: four yes or no, all « Oui » at first so
 * that nothing disappears unless the owner says so. The answers choose
 * what the application shows; everything is changed later in Paramètres.
 */
export function HabitsField({
  errors,
}: {
  errors?: Partial<Record<string, string>>;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-base font-semibold">
        Comment travaillez-vous ?
      </legend>
      {QUESTIONS.map(({ name, label, hint, icon: Icon }) => (
        <fieldset
          key={name}
          className="flex items-center gap-3 rounded-3xl bg-surface p-3"
          aria-describedby={errors?.[name] ? `${name}-error` : undefined}
        >
          <legend className="sr-only">{label}</legend>
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-canvas">
            <Icon aria-hidden className="size-5" />
          </span>
          <span aria-hidden className="flex min-w-0 flex-1 flex-col">
            <span className="font-bold">{label}</span>
            <span className="text-sm text-ink-muted">{hint}</span>
          </span>
          <span className="flex shrink-0 gap-1.5">
            {(['oui', 'non'] as const).map((answer) => (
              <label
                key={answer}
                className="flex min-h-11 min-w-14 cursor-pointer items-center justify-center rounded-full bg-canvas px-3 font-extrabold focus-within:outline-3 focus-within:outline-focus has-checked:bg-ink has-checked:text-canvas"
              >
                <input
                  type="radio"
                  name={name}
                  value={answer}
                  defaultChecked={answer === 'oui'}
                  className="sr-only"
                />
                {answer === 'oui' ? 'Oui' : 'Non'}
              </label>
            ))}
          </span>
          {errors?.[name] && (
            <p id={`${name}-error`} role="alert" className="sr-only">
              {errors[name]}
            </p>
          )}
        </fieldset>
      ))}
      <p className="text-ink-muted">
        L’application n’affiche que ce qui vous sert. Rien n’est supprimé : tout
        se rajoute dans Paramètres › Mon application.
      </p>
    </fieldset>
  );
}
