'use client';

import { sellsGoods, type ShopHabits, type ShopOffer } from '@nagaw/shared';
import {
  FileText,
  HandCoins,
  Package,
  Users,
  type LucideIcon,
} from 'lucide-react';

/** The four questions of « Comment travaillez-vous ? » (ADR-067). */
const QUESTIONS: {
  name: keyof ShopHabits;
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
 * « Comment travaillez-vous ? »: four yes or no (maquette « Profils »). A
 * shop of services is not asked about stock: it has none (ADR-045).
 */
export function HabitsField({
  offer,
  value,
  onChange,
  errors,
}: {
  offer: ShopOffer;
  value: ShopHabits;
  onChange: (habits: ShopHabits) => void;
  errors?: Partial<Record<string, string>>;
}) {
  const questions = QUESTIONS.filter(
    (question) => question.name !== 'stock' || sellsGoods(offer),
  );
  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="mb-1 text-2xl font-extrabold">
        Comment travaillez-vous ?
      </legend>
      {!sellsGoods(offer) && <input type="hidden" name="stock" value="oui" />}
      {questions.map(({ name, label, hint, icon: Icon }) => (
        <fieldset
          key={name}
          className="flex items-center gap-3 rounded-3xl bg-surface p-3"
        >
          <legend className="sr-only">{label}</legend>
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-canvas">
            <Icon aria-hidden className="size-5" />
          </span>
          <span aria-hidden className="flex min-w-0 flex-1 flex-col">
            <span className="font-bold">{label}</span>
            <span className="text-sm text-ink-muted">{hint}</span>
          </span>
          <span className="flex w-20 shrink-0 flex-col gap-1.5">
            {([true, false] as const).map((answer) => (
              <label
                key={String(answer)}
                className={`flex min-h-11 cursor-pointer items-center justify-center rounded-full px-3 font-extrabold focus-within:outline-3 focus-within:outline-focus ${
                  value[name] === answer ? 'bg-ink text-canvas' : 'bg-canvas'
                }`}
              >
                <input
                  type="radio"
                  name={name}
                  value={answer ? 'oui' : 'non'}
                  checked={value[name] === answer}
                  onChange={() => onChange({ ...value, [name]: answer })}
                  className="sr-only"
                />
                {answer ? 'Oui' : 'Non'}
              </label>
            ))}
          </span>
          {errors?.[name] && (
            <p role="alert" className="sr-only">
              {errors[name]}
            </p>
          )}
        </fieldset>
      ))}
    </fieldset>
  );
}
