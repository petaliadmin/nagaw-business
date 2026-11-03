'use client';

import { ACCOUNT_COUNTRIES, DEFAULT_ACCOUNT_COUNTRY } from '@nagaw/shared';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

/**
 * The country of a phone number (ADR-058). Closed, it shows the country
 * and its code in full (`SN +221`); open, the native list names each
 * country (`Sénégal (+221)`). The real select lies invisible on top: touch,
 * keyboard and screen readers use it as any select. It covers the border
 * too, so the touch target is the full 48 px of the box.
 */
export function CountrySelect({
  id,
  invalid,
  describedBy,
  className,
}: {
  id: string;
  invalid?: boolean;
  describedBy?: string;
  /** Box look of the controls (border, height, text size). */
  className: string;
}) {
  const [iso, setIso] = useState<string>(DEFAULT_ACCOUNT_COUNTRY);
  const country =
    ACCOUNT_COUNTRIES.find((c) => c.iso === iso) ?? ACCOUNT_COUNTRIES[0];
  return (
    <div
      className={`${className} relative flex shrink-0 items-center gap-1 px-3 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus has-[:focus-visible]:outline-solid`}
    >
      <span aria-hidden className="font-semibold whitespace-nowrap">
        {country.iso} +{country.code}
      </span>
      <ChevronDown aria-hidden className="size-5 shrink-0 text-ink-muted" />
      <select
        id={id}
        name="country"
        aria-label="Pays"
        value={iso}
        onChange={(event) => setIso(event.target.value)}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        className="absolute -inset-0.5 cursor-pointer opacity-0 focus-visible:outline-none"
      >
        {ACCOUNT_COUNTRIES.map((c) => (
          <option key={c.iso} value={c.iso}>
            {c.name} (+{c.code})
          </option>
        ))}
      </select>
    </div>
  );
}
