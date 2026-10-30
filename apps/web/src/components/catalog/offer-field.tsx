'use client';

import type { ShopOffer } from '@nagaw/shared';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { OFFER_OPTIONS } from '@/lib/catalog/offer';

/** « Que vend la boutique ? »: its screens follow the answer (ADR-047). */
export function OfferField({
  value,
  error,
}: {
  value: ShopOffer;
  error?: string;
}) {
  const [offer, setOffer] = useState(value);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-base font-semibold">
        Que vendez-vous ?
      </legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {OFFER_OPTIONS.map((option) => (
          <label
            key={option.value}
            className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-2 text-base font-bold focus-within:outline-3 focus-within:outline-focus ${
              offer === option.value
                ? 'border-stock-strong bg-stock-soft text-stock-ink'
                : 'border-line-strong bg-surface'
            }`}
          >
            <input
              type="radio"
              name="offer"
              value={option.value}
              checked={offer === option.value}
              onChange={() => setOffer(option.value)}
              className="sr-only"
            />
            {/* The choice is not told by its colour alone (DESIGN.md). */}
            <Check
              aria-hidden
              className={`size-5 shrink-0 ${offer === option.value ? '' : 'invisible'}`}
            />
            {option.label}
          </label>
        ))}
      </div>
      <p className="text-ink-muted">
        L’application n’affiche que ce qui vous sert. Vous pourrez changer ce
        choix dans Paramètres.
      </p>
      {error && (
        <p role="alert" className="text-base font-medium text-danger-ink">
          {error}
        </p>
      )}
    </fieldset>
  );
}
