'use client';

import { DEPOSIT_METHODS, MOBILE_MONEY_PROVIDERS } from '@nagaw/shared';
import { useId, useState } from 'react';
import { CONTROL } from '@/components/form-field';
import { PAYMENT_LABELS, PROVIDER_LABELS } from '@/lib/sales/labels';

/**
 * How money comes in or goes back (ADR-072): cash, Mobile Money with its
 * operator, or card. Fields `${prefix}Method`, `${prefix}Provider`,
 * `${prefix}Reference`.
 */
export function MoneyInFields({
  prefix,
  legend,
  errors = {},
}: {
  prefix: string;
  legend: string;
  errors?: Record<string, string>;
}) {
  const ids = useId();
  const [method, setMethod] =
    useState<(typeof DEPOSIT_METHODS)[number]>('cash');
  const providerError = errors[`${prefix}.provider`];
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1.5 font-semibold">{legend}</legend>
      <div className="grid grid-cols-3 gap-2">
        {DEPOSIT_METHODS.map((value) => (
          <label
            key={value}
            className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl border-2 px-2 text-center font-bold focus-within:outline-3 focus-within:outline-focus ${
              method === value
                ? 'border-sales-strong bg-sales-soft text-sales-ink'
                : 'border-line-strong bg-surface'
            }`}
          >
            <input
              type="radio"
              name={`${prefix}Method`}
              value={value}
              checked={method === value}
              onChange={() => setMethod(value)}
              className="sr-only"
            />
            {PAYMENT_LABELS[value]}
          </label>
        ))}
      </div>
      {method === 'mobile_money' && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${ids}-provider`} className="font-semibold">
              Opérateur
            </label>
            <select
              id={`${ids}-provider`}
              name={`${prefix}Provider`}
              defaultValue=""
              aria-invalid={providerError ? true : undefined}
              className={CONTROL}
            >
              <option value="" disabled>
                Choisissez
              </option>
              {MOBILE_MONEY_PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {PROVIDER_LABELS[p]}
                </option>
              ))}
            </select>
            {providerError && (
              <p className="font-medium text-danger-ink">{providerError}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${ids}-reference`} className="font-semibold">
              N° de transaction (facultatif)
            </label>
            <input
              id={`${ids}-reference`}
              name={`${prefix}Reference`}
              maxLength={60}
              autoComplete="off"
              className={CONTROL}
            />
          </div>
        </div>
      )}
    </fieldset>
  );
}
