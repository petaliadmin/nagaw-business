'use client';

import { INVITATION_TTL_HOURS, type OrganizationDto } from '@nagaw/shared';
import { useActionState } from 'react';
import { FormField } from '@/components/form-field';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { initialFormState } from '@/lib/auth/schemas';
import { updateOrganization } from '../actions';

function SelectField({
  label,
  name,
  defaultValue,
  options,
  error,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: string[];
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {error && (
        <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

export function OrganizationSettingsForm({
  organization,
  timeZones,
  currencies,
}: {
  organization: OrganizationDto;
  timeZones: string[];
  currencies: string[];
}) {
  const [state, action] = useActionState(updateOrganization, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="organizationId" value={organization.id} />
      <FormMessage state={state} />
      <FormField
        label="Nom de l’organisation"
        name="name"
        defaultValue={organization.name}
        required
        minLength={2}
        maxLength={120}
        error={state.fieldErrors?.name}
      />
      <SelectField
        label="Fuseau horaire"
        name="timezone"
        defaultValue={organization.timezone}
        options={timeZones}
        error={state.fieldErrors?.timezone}
      />
      <SelectField
        label="Devise par défaut"
        name="defaultCurrency"
        defaultValue={organization.defaultCurrency}
        options={currencies}
        error={state.fieldErrors?.defaultCurrency}
      />
      <FormField
        label="Durée de validité des invitations (heures)"
        name="invitationTtlHours"
        type="number"
        inputMode="numeric"
        min={INVITATION_TTL_HOURS.min}
        max={INVITATION_TTL_HOURS.max}
        step={1}
        defaultValue={organization.invitationTtlHours}
        required
        error={state.fieldErrors?.invitationTtlHours}
      />
      <div>
        <SubmitButton pendingLabel="Enregistrement…">Enregistrer</SubmitButton>
      </div>
    </form>
  );
}
