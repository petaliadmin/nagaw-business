'use client';

import type { ShopOffer } from '@nagaw/shared';
import {
  Check,
  Package,
  Scissors,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

const CARDS: {
  value: ShopOffer;
  label: string;
  hint: string;
  icon: LucideIcon;
  tone: string;
}[] = [
  {
    value: 'products',
    label: 'Des produits',
    hint: 'Légumes, savons, tissus, téléphones…',
    icon: Package,
    tone: 'text-sales-ink',
  },
  {
    value: 'services',
    label: 'Des services',
    hint: 'Couture, coiffure, massage, réparation…',
    icon: Scissors,
    tone: 'text-warning-ink',
  },
  {
    value: 'both',
    label: 'Les deux',
    hint: 'Je fais des soins ou des travaux et je vends des produits',
    icon: Sparkles,
    tone: 'text-stock-ink',
  },
];

/** What the choice changes, said at once (maquette « Que vendez-vous ? »). */
const NOTES: Record<ShopOffer, string> = {
  products: 'Vos articles s’appelleront « Produits ».',
  services: 'Vos articles s’appelleront « Services », sans stock à compter.',
  both: '« Produits et services » : la caisse montre les deux, le stock ne compte que les produits.',
};

/**
 * « Que vendez-vous ? » in large cards with a picture (ADR-047, maquette
 * « Profils »): the step of the shop's creation.
 */
export function OfferCards({
  value,
  onChange,
  error,
}: {
  value: ShopOffer;
  onChange: (offer: ShopOffer) => void;
  error?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="mb-1 text-2xl font-extrabold">
        Que vendez-vous ?
      </legend>
      <p className="mb-1 text-ink-muted">
        L’application n’affiche que ce qui vous sert. Vous pourrez changer ce
        choix dans Paramètres.
      </p>
      {CARDS.map(({ value: option, label, hint, icon: Icon, tone }) => {
        const checked = value === option;
        return (
          <label
            key={option}
            className={`flex cursor-pointer items-center gap-3.5 rounded-3xl p-3.5 focus-within:outline-3 focus-within:outline-focus ${
              checked
                ? 'bg-canvas ring-[2.5px] ring-ink ring-inset'
                : 'bg-surface'
            }`}
          >
            <input
              type="radio"
              name="offer"
              value={option}
              checked={checked}
              onChange={() => onChange(option)}
              className="sr-only"
            />
            <span
              className={`flex size-14 shrink-0 items-center justify-center rounded-2xl ${
                checked ? 'bg-surface' : 'bg-canvas'
              } ${tone}`}
            >
              <Icon aria-hidden className="size-7" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-lg font-extrabold">{label}</span>
              <span className="text-sm text-ink-muted">{hint}</span>
            </span>
            {/* The choice is not told by its colour alone (DESIGN.md). */}
            <span
              aria-hidden
              className={`flex size-7 shrink-0 items-center justify-center rounded-full ${
                checked
                  ? 'bg-ink text-canvas'
                  : 'ring-2 ring-line-strong ring-inset'
              }`}
            >
              {checked && <Check className="size-4" strokeWidth={3} />}
            </span>
          </label>
        );
      })}
      <p
        role="status"
        className="flex items-center gap-2.5 rounded-2xl bg-surface p-3 font-bold"
      >
        <Check aria-hidden className="size-5 shrink-0" strokeWidth={2.6} />
        {NOTES[value]}
      </p>
      {error && (
        <p role="alert" className="font-medium text-danger-ink">
          {error}
        </p>
      )}
    </fieldset>
  );
}
