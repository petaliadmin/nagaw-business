'use client';

import { ACCOUNT_COUNTRIES, DEFAULT_ACCOUNT_COUNTRY } from '@nagaw/shared';
import {
  BF,
  BJ,
  CD,
  CG,
  CI,
  CM,
  FR,
  GA,
  GM,
  GN,
  GW,
  MA,
  ML,
  MR,
  NE,
  SN,
  TG,
  type FlagComponent,
} from 'country-flag-icons/react/3x2';
import { Check, ChevronDown } from 'lucide-react';
import { useState, type ChangeEvent } from 'react';
import PhoneInput, {
  getCountryCallingCode,
  isValidPhoneNumber,
  type Country,
  type Labels,
} from 'react-phone-number-input';
import { CONTROL, FormField } from './form-field';

/*
 * The number field of `react-phone-number-input` (ADR-064): the flag of
 * the country, the number formatted as it is typed (`77 123 45 67`), and
 * the country found again when the number starts with `+`. The server
 * checks it again with the full telephone plans.
 */

/** Only the flags of the countries served: no image fetched elsewhere. */
const FLAGS: Partial<Record<Country, FlagComponent>> = {
  BF,
  BJ,
  CD,
  CG,
  CI,
  CM,
  FR,
  GA,
  GM,
  GN,
  GW,
  MA,
  ML,
  MR,
  NE,
  SN,
  TG,
};

const COUNTRIES = ACCOUNT_COUNTRIES.map((c) => c.iso) as Country[];

/** « Sénégal (+221) » in the list, as before (ADR-058). */
const LABELS: Labels = {
  country: 'Pays',
  phone: 'Numéro de téléphone',
  ZZ: 'Autre pays',
  ext: 'poste',
  ...Object.fromEntries(
    ACCOUNT_COUNTRIES.map((c) => [c.iso, `${c.name} (+${c.code})`]),
  ),
};

interface PickerProps {
  value?: Country;
  onChange: (country?: Country) => void;
  options: { value?: Country; label: string; divider?: boolean }[];
  disabled?: boolean;
  readOnly?: boolean;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

/**
 * Closed, the flag and the code (`🇸🇳 +221`); open, the phone's own list
 * names each country. The real select lies invisible on top: touch,
 * keyboard and screen readers use it as any select, on its full 48 px.
 */
function CountryPicker({
  value,
  onChange,
  options,
  disabled,
  readOnly,
  'aria-invalid': invalid,
  'aria-describedby': describedBy,
}: PickerProps) {
  const Flag = value ? FLAGS[value] : undefined;
  return (
    <div className="relative flex min-h-12 shrink-0 items-center gap-2 rounded-2xl border-2 border-line-strong bg-canvas px-3 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus has-[:focus-visible]:outline-solid">
      {Flag && (
        <Flag
          aria-hidden
          className="h-5 w-7.5 shrink-0 rounded-[3px] ring-1 ring-line"
        />
      )}
      <span aria-hidden className="font-bold whitespace-nowrap tabular-nums">
        {value ? `+${getCountryCallingCode(value)}` : '+'}
      </span>
      <ChevronDown aria-hidden className="size-5 shrink-0 text-ink-muted" />
      <select
        name="country"
        aria-label="Pays"
        value={value ?? ''}
        disabled={disabled || readOnly}
        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
          onChange((event.target.value || undefined) as Country | undefined)
        }
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className="absolute -inset-0.5 cursor-pointer opacity-0 focus-visible:outline-none"
      >
        {options
          .filter((o) => !o.divider && o.value)
          .map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
      </select>
    </div>
  );
}

/**
 * Country and number on one line: Senegal first. One visible label for
 * both; the form sends the country (`country`) and the number as typed
 * with its code (`number`, `+221771234567`).
 */
export function PhoneField({
  errors,
  idPrefix = '',
  label = 'Numéro de téléphone',
}: {
  errors?: Record<string, string>;
  label?: string;
  /** Set it when the same form repeats on a page. */
  idPrefix?: string;
}) {
  const [value, setValue] = useState<string | undefined>();
  const [country, setCountry] = useState<Country>(
    DEFAULT_ACCOUNT_COUNTRY as Country,
  );
  const numberId = `${idPrefix}number`;
  const error = errors?.number ?? errors?.country;
  const errorId = error ? `${numberId}-error` : undefined;
  const valid = value ? isValidPhoneNumber(value) : false;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={numberId} className="text-base font-semibold">
        {label}
      </label>
      <input type="hidden" name="number" value={value ?? ''} />
      <PhoneInput
        id={numberId}
        value={value}
        onChange={setValue}
        defaultCountry={DEFAULT_ACCOUNT_COUNTRY as Country}
        onCountryChange={(next) => next && setCountry(next)}
        countries={COUNTRIES}
        countryOptionsOrder={COUNTRIES}
        addInternationalOption={false}
        labels={LABELS}
        countrySelectComponent={CountryPicker}
        countrySelectProps={{
          'aria-invalid': errors?.country ? true : undefined,
          'aria-describedby': errors?.country ? errorId : undefined,
        }}
        focusInputOnCountrySelection
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder={country === 'SN' ? '77 123 45 67' : undefined}
        required
        aria-invalid={errors?.number ? true : undefined}
        aria-describedby={errors?.number ? errorId : undefined}
        className="flex gap-2"
        numberInputProps={{
          className: `${CONTROL.replace('w-full', '')} min-w-0 flex-1 text-lg font-bold tracking-wide tabular-nums`,
        }}
      />
      {error ? (
        <p id={errorId} className="text-base font-medium text-danger-ink">
          {error}
        </p>
      ) : (
        valid && (
          <p className="flex items-center gap-1.5 font-semibold text-sales-ink">
            <Check aria-hidden className="size-5" strokeWidth={2.6} />
            Numéro valide
          </p>
        )
      )}
    </div>
  );
}

/** A 4-digit secret code: digits keyboard, hidden as it is typed. */
export function PinField({
  label = 'Code secret (4 chiffres)',
  name = 'pin',
  id = name,
  autoComplete,
  hint,
  error,
}: {
  label?: string;
  name?: string;
  id?: string;
  autoComplete: 'current-password' | 'new-password';
  hint?: string;
  error?: string;
}) {
  return (
    <FormField
      label={label}
      name={name}
      id={id}
      type="password"
      inputMode="numeric"
      pattern="[0-9]{4}"
      maxLength={4}
      autoComplete={autoComplete}
      hint={hint}
      required
      error={error}
    />
  );
}
