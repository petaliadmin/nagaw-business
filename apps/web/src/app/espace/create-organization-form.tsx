'use client';

import { useActionState } from 'react';
import { ActionForm } from '@/components/action-form';
import { OfferField } from '@/components/catalog/offer-field';
import { FormField } from '@/components/form-field';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { initialFormState } from '@/lib/auth/schemas';
import { createOrganization } from './actions';

export function CreateOrganizationForm({
  ownerName,
}: {
  /** Already known for a second shop. */
  ownerName?: string | null;
}) {
  const [state, action, pending] = useActionState(
    createOrganization,
    initialFormState,
  );
  return (
    <ActionForm
      action={action}
      pending={pending}
      className="flex flex-col gap-4"
      noValidate
    >
      <FormMessage state={state} />
      <FormField
        label="Nom de la boutique"
        name="name"
        autoComplete="organization"
        required
        minLength={2}
        maxLength={120}
        error={state.fieldErrors?.name}
      />
      <FormField
        label="Votre nom complet"
        name="ownerName"
        autoComplete="name"
        defaultValue={ownerName ?? undefined}
        required
        minLength={2}
        maxLength={120}
        error={state.fieldErrors?.ownerName}
      />
      <FormField
        label="Votre téléphone"
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        hint="Il figure sur vos factures et vos devis. Vous pourrez le changer dans Paramètres."
        required
        maxLength={30}
        error={state.fieldErrors?.phone}
      />
      <OfferField value="products" error={state.fieldErrors?.offer} />
      <SubmitButton pendingLabel="Création…">Créer la boutique</SubmitButton>
    </ActionForm>
  );
}
