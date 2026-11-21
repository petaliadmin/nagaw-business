'use client';

import { useActionState } from 'react';
import { ActionForm } from '@/components/action-form';
import { HabitsField } from '@/components/catalog/habits-field';
import { OfferField } from '@/components/catalog/offer-field';
import { FormField } from '@/components/form-field';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { initialFormState } from '@/lib/auth/form-state';
import { createOrganization } from './actions';

export function CreateOrganizationForm({
  ownerName,
  phone,
}: {
  /** Already known for a second shop. */
  ownerName?: string | null;
  /** International digits of the account, when it signed up by phone. */
  phone?: string | null;
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
        hint="Il apparaît sur vos tickets et vos factures."
        required
        minLength={2}
        maxLength={120}
        error={state.fieldErrors?.name}
      />
      {/* V3: only what is not known yet is asked (ADR-063). */}
      {ownerName ? (
        <input type="hidden" name="ownerName" value={ownerName} />
      ) : (
        <FormField
          label="Votre nom complet"
          name="ownerName"
          autoComplete="name"
          required
          minLength={2}
          maxLength={120}
          error={state.fieldErrors?.ownerName}
        />
      )}
      {phone && !state.fieldErrors?.phone ? (
        <input type="hidden" name="phone" value={`+${phone}`} />
      ) : (
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
      )}
      <OfferField
        value="products"
        legend="Vous vendez surtout"
        error={state.fieldErrors?.offer}
      />
      <HabitsField errors={state.fieldErrors} />
      <p className="text-ink-muted">
        Gratuit pour commencer, sans carte bancaire.
      </p>
      <SubmitButton pendingLabel="Création…">Créer ma boutique</SubmitButton>
    </ActionForm>
  );
}
