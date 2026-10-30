'use client';

import { INVITATION_TTL_HOURS, type OrganizationDto } from '@nagaw/shared';
import { useActionState } from 'react';
import { ActionForm } from '@/components/action-form';
import { OfferField } from '@/components/catalog/offer-field';
import { FormField, SelectField } from '@/components/form-field';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { initialFormState } from '@/lib/auth/schemas';
import { updateOrganization } from '../actions';

const asOptions = (values: string[]) =>
  values.map((value) => ({ value, label: value }));

export function OrganizationSettingsForm({
  organization,
  timeZones,
  currencies,
}: {
  organization: OrganizationDto;
  timeZones: string[];
  currencies: string[];
}) {
  const [state, action, pending] = useActionState(
    updateOrganization,
    initialFormState,
  );
  return (
    <ActionForm
      action={action}
      pending={pending}
      className="flex flex-col gap-4"
      noValidate
    >
      <input type="hidden" name="organizationId" value={organization.id} />
      <FormMessage state={state} />
      <FormField
        label="Nom de la boutique"
        name="name"
        defaultValue={organization.name}
        required
        minLength={2}
        maxLength={120}
        error={state.fieldErrors?.name}
      />
      <OfferField value={organization.offer} error={state.fieldErrors?.offer} />
      <SelectField
        label="Fuseau horaire"
        name="timezone"
        defaultValue={organization.timezone}
        options={asOptions(timeZones)}
        error={state.fieldErrors?.timezone}
      />
      <SelectField
        label="Devise par défaut"
        name="defaultCurrency"
        defaultValue={organization.defaultCurrency}
        options={asOptions(currencies)}
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
    </ActionForm>
  );
}
