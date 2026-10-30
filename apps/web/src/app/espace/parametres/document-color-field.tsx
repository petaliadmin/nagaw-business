'use client';

import { DOCUMENT_COLORS, documentPalette } from '@nagaw/shared';
import { Check } from 'lucide-react';
import { useState } from 'react';

/**
 * The colour of the shop's documents: named colours (a word with each, never
 * the colour alone) or any other. The sample shows it as on an invoice.
 */
export function DocumentColorField({
  value,
  error,
}: {
  value: string;
  error?: string;
}) {
  const [color, setColor] = useState(value);
  const palette = documentPalette(color);
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1.5 text-base font-semibold">
        Couleur de vos documents
      </legend>
      <p className="text-ink-muted">
        Elle s’applique à vos factures, vos devis et vos tickets.
      </p>
      <input type="hidden" name="documentColor" value={color} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {DOCUMENT_COLORS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={color === option.value}
            onClick={() => setColor(option.value)}
            className={`flex min-h-12 items-center gap-2 rounded-xl border-2 bg-surface px-3 text-base font-bold ${
              color === option.value ? 'border-ink' : 'border-line-strong'
            }`}
          >
            <span
              aria-hidden
              className="flex size-6 shrink-0 items-center justify-center rounded-full text-white"
              style={{ background: option.value }}
            >
              {color === option.value && <Check className="size-4" />}
            </span>
            {option.label}
          </button>
        ))}
      </div>
      <label className="inline-flex min-h-12 items-center gap-3 text-base font-semibold">
        <input
          type="color"
          value={color}
          onChange={(event) => setColor(event.currentTarget.value)}
          className="h-12 w-16 shrink-0 cursor-pointer rounded-xl border-2 border-line-strong bg-surface p-1"
        />
        Autre couleur
      </label>
      <div
        aria-hidden
        className="flex items-center justify-between rounded-xl px-4 py-3 font-bold"
        style={{ background: palette.accent, color: palette.onAccent }}
      >
        <span>Total TTC</span>
        <span className="tabular-nums">12 500 F CFA</span>
      </div>
      {error && (
        <p role="alert" className="text-base font-medium text-danger-ink">
          {error}
        </p>
      )}
    </fieldset>
  );
}
