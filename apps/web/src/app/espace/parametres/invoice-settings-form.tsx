'use client';

import type { OrganizationDto } from '@nagaw/shared';
import { useActionState } from 'react';
import { ActionForm } from '@/components/action-form';
import { FormField } from '@/components/form-field';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { initialFormState } from '@/lib/auth/schemas';
import { updateOrganization } from '../actions';
import { DocumentColorField } from './document-color-field';

/** What quotes and invoices print about the shop (ADR-026). */
export function InvoiceSettingsForm({
  organization,
}: {
  organization: OrganizationDto;
}) {
  const [state, action, pending] = useActionState(
    updateOrganization,
    initialFormState,
  );
  const errors = state.fieldErrors ?? {};
  return (
    <ActionForm
      action={action}
      pending={pending}
      className="flex flex-col gap-4"
      noValidate
    >
      <input type="hidden" name="organizationId" value={organization.id} />
      <FormMessage state={state} />
      <DocumentColorField
        value={organization.documentColor}
        error={errors.documentColor}
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField
          label="Raison sociale (facultatif)"
          name="legalName"
          id="shop-legalName"
          defaultValue={organization.legalName}
          maxLength={160}
          placeholder={organization.name}
          error={errors.legalName}
        />
        <FormField
          label="Adresse"
          name="address"
          id="shop-address"
          defaultValue={organization.address}
          maxLength={300}
          error={errors.address}
        />
        <FormField
          label="Téléphone"
          name="phone"
          id="shop-phone"
          type="tel"
          inputMode="tel"
          defaultValue={organization.phone}
          maxLength={30}
          error={errors.phone}
        />
        <FormField
          label="E-mail (facultatif)"
          name="email"
          id="shop-email"
          type="email"
          inputMode="email"
          defaultValue={organization.email}
          maxLength={320}
          error={errors.email}
        />
        <FormField
          label="NINEA (facultatif)"
          name="taxId"
          id="shop-taxId"
          defaultValue={organization.taxId}
          maxLength={40}
          error={errors.taxId}
        />
        <FormField
          label="RCCM (facultatif)"
          name="tradeRegister"
          id="shop-tradeRegister"
          defaultValue={organization.tradeRegister}
          maxLength={60}
          error={errors.tradeRegister}
        />
        <FormField
          label="Délai de paiement des factures (jours)"
          name="invoiceDueDays"
          id="shop-invoiceDueDays"
          type="number"
          inputMode="numeric"
          min={0}
          max={365}
          step={1}
          defaultValue={organization.invoiceDueDays}
          required
          error={errors.invoiceDueDays}
        />
        <FormField
          label="Durée de validité des devis (jours)"
          name="quoteValidityDays"
          id="shop-quoteValidityDays"
          type="number"
          inputMode="numeric"
          min={1}
          max={365}
          step={1}
          defaultValue={organization.quoteValidityDays}
          required
          error={errors.quoteValidityDays}
        />
      </div>
      <FormField
        label="Mention en bas des documents (facultatif)"
        name="invoiceFooter"
        id="shop-invoiceFooter"
        defaultValue={organization.invoiceFooter}
        maxLength={500}
        placeholder="Merci pour votre confiance. Paiement par Wave au …"
        error={errors.invoiceFooter}
      />
      <div>
        <SubmitButton pendingLabel="Enregistrement…">Enregistrer</SubmitButton>
      </div>
    </ActionForm>
  );
}
