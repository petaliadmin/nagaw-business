import { CountrySelect } from './country-select';
import { CONTROL, FormField } from './form-field';

// Side by side, each control sets its own width (CONTROL is full width).
const INLINE_CONTROL = CONTROL.replace('w-full', '');

/**
 * Country code and number on one line (ADR-058): Senegal is chosen first.
 * The number is typed as people know it (`77 123 45 67`); the server adds
 * the code. One visible label for both, each control keeps its own name.
 */
export function PhoneField({
  errors,
  idPrefix = '',
}: {
  errors?: Record<string, string>;
  /** Set it when the same form repeats on a page. */
  idPrefix?: string;
}) {
  const countryId = `${idPrefix}country`;
  const numberId = `${idPrefix}number`;
  const error = errors?.number ?? errors?.country;
  const errorId = error ? `${numberId}-error` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={numberId} className="text-base font-semibold">
        Numéro de téléphone
      </label>
      <div className="flex gap-2">
        <CountrySelect
          id={countryId}
          invalid={Boolean(errors?.country)}
          describedBy={errors?.country ? errorId : undefined}
          className={INLINE_CONTROL}
        />
        <input
          id={numberId}
          name="number"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="77 123 45 67"
          required
          aria-invalid={errors?.number ? true : undefined}
          aria-describedby={errors?.number ? errorId : undefined}
          className={`${INLINE_CONTROL} min-w-0 flex-1`}
        />
      </div>
      {error && (
        <p id={errorId} className="text-base font-medium text-danger-ink">
          {error}
        </p>
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
