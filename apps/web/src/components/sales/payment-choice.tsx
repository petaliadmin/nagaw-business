'use client';

import {
  MOBILE_MONEY_PROVIDERS,
  type MobileMoneyProvider,
} from '@nagaw/shared';
import { Banknote } from 'lucide-react';
import { createElement, type ReactNode } from 'react';
import { OperatorLogo } from '@/components/sales/operator-logo';
import { PROVIDER_LABELS } from '@/lib/sales/labels';
import { METHOD_PICTURES } from '@/lib/sales/method-pictures';

const PILL =
  'inline-flex min-h-12 items-center gap-2 rounded-full border-2 border-transparent bg-surface py-1 pr-4 pl-1.5 font-bold peer-checked:border-ink peer-checked:bg-canvas peer-focus-visible:outline-3 peer-focus-visible:outline-focus';

function Pill({
  name,
  value,
  picture,
  label,
  checked,
  defaultChecked,
  onChange,
}: {
  name: string;
  value: string;
  picture: ReactNode;
  label: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: () => void;
}) {
  return (
    <label className="relative cursor-pointer">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={onChange}
        className="peer sr-only"
      />
      <span className={PILL}>
        {picture}
        {label}
      </span>
    </label>
  );
}

/**
 * How the customer paid, as pictures with their names instead of a list
 * to read: banknotes, a phone, a card…
 */
export function MethodPills({
  methods,
  value,
  onChange,
  legend = 'Payé en',
  name = 'method',
}: {
  methods: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  legend?: string;
  name?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-base font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {methods.map((m) => (
          <Pill
            key={m.value}
            name={name}
            value={m.value}
            label={m.label}
            checked={value === m.value}
            onChange={() => onChange(m.value)}
            picture={
              <span
                aria-hidden
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-canvas"
              >
                {createElement(METHOD_PICTURES[m.value] ?? Banknote, {
                  className: 'size-5',
                })}
              </span>
            }
          />
        ))}
      </div>
    </fieldset>
  );
}

/** The operator, with its own logo: Wave, Orange Money, Mixx… */
export function ProviderPills({
  name = 'provider',
  defaultValue = 'wave',
  error,
}: {
  name?: string;
  defaultValue?: MobileMoneyProvider;
  error?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-base font-semibold">Opérateur</legend>
      <div className="flex flex-wrap gap-2">
        {MOBILE_MONEY_PROVIDERS.map((p) => (
          <Pill
            key={p}
            name={name}
            value={p}
            label={PROVIDER_LABELS[p]}
            defaultChecked={p === defaultValue}
            picture={<OperatorLogo provider={p} className="size-8" />}
          />
        ))}
      </div>
      {error && <p className="font-semibold text-danger-ink">{error}</p>}
    </fieldset>
  );
}
