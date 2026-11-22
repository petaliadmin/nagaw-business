'use client';

import { sellsGoods, showsSection, type OrganizationDto } from '@nagaw/shared';
import { Lock } from 'lucide-react';
import { useActionState } from 'react';
import { ActionForm } from '@/components/action-form';
import { OfferField } from '@/components/catalog/offer-field';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { initialFormState } from '@/lib/auth/form-state';
import { SECTION_OPTIONS } from '@/lib/shop/sections';
import { updateDisplay } from '../actions';

/** A checkbox drawn as a switch: the state is also told by its label. */
function Toggle({
  name,
  value,
  defaultChecked,
  label,
}: {
  name: string;
  value: string;
  defaultChecked: boolean;
  label: string;
}) {
  return (
    <span className="relative inline-flex h-8 w-13 shrink-0">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        aria-label={label}
        className="peer absolute inset-0 z-10 cursor-pointer opacity-0"
      />
      <span
        aria-hidden
        className="absolute inset-0 rounded-full bg-line-strong transition-colors peer-checked:bg-sales-strong peer-focus-visible:outline-3 peer-focus-visible:outline-focus"
      />
      <span
        aria-hidden
        className="absolute top-1 left-1 size-6 rounded-full bg-canvas transition-transform peer-checked:translate-x-5"
      />
    </span>
  );
}

/**
 * « Mon application » (ADR-067): what the shop sells, the parts of the menu
 * it shows and whether a new product counts its stock. A display setting:
 * hiding a part deletes nothing.
 */
export function DisplaySettingsForm({
  organization,
}: {
  organization: OrganizationDto;
}) {
  const [state, action, pending] = useActionState(
    updateDisplay,
    initialFormState,
  );
  const [allState, allAction, allPending] = useActionState(
    updateDisplay,
    initialFormState,
  );
  const hidesSomething =
    organization.hiddenSections.length > 0 ||
    !organization.countsStockByDefault;
  return (
    <div className="flex flex-col gap-6">
      <ActionForm
        action={action}
        pending={pending}
        className="flex flex-col gap-6"
        noValidate
      >
        <input type="hidden" name="organizationId" value={organization.id} />
        <FormMessage state={state} />
        <OfferField
          value={organization.offer}
          legend="Vous vendez"
          error={state.fieldErrors?.offer}
        />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-base font-semibold">
            Dans le Menu
          </legend>
          <ul className="flex flex-col divide-y divide-line rounded-3xl bg-surface px-4">
            {SECTION_OPTIONS.map(({ section, label, icon: Icon }) => (
              <li key={section}>
                <label className="flex min-h-16 cursor-pointer items-center gap-3 py-2 font-bold">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-canvas">
                    <Icon aria-hidden className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">{label}</span>
                  <Toggle
                    name="show"
                    value={section}
                    defaultChecked={showsSection(organization, section)}
                    label={`Afficher ${label}`}
                  />
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
        {sellsGoods(organization.offer) && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-base font-semibold">Stock</legend>
            <input type="hidden" name="stockAsked" value="1" />
            <label className="flex min-h-16 cursor-pointer items-center gap-3 rounded-3xl bg-surface px-4 py-2">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-bold">
                  Compter le stock des nouveaux produits
                </span>
                <span className="text-sm text-ink-muted">
                  Chaque produit garde son propre choix.
                </span>
              </span>
              <Toggle
                name="countsStockByDefault"
                value="on"
                defaultChecked={organization.countsStockByDefault}
                label="Compter le stock des nouveaux produits"
              />
            </label>
          </fieldset>
        )}
        <p className="flex gap-2 rounded-2xl bg-sales-soft p-3 font-bold text-sales-ink">
          <Lock aria-hidden className="mt-0.5 size-5 shrink-0" />
          Caisse, Ventes, Produits et Argent restent toujours. Cacher une partie
          ne supprime rien.
        </p>
        <SubmitButton pendingLabel="Enregistrement…">Enregistrer</SubmitButton>
      </ActionForm>
      {/* Kept after « Tout afficher », to say it is done. */}
      {(hidesSomething || allState.status !== 'idle') && (
        <ActionForm
          action={allAction}
          pending={allPending}
          className="flex flex-col gap-2"
        >
          <input type="hidden" name="organizationId" value={organization.id} />
          <input type="hidden" name="intent" value="all" />
          <FormMessage state={allState} />
          {hidesSomething && (
            <SubmitButton pendingLabel="Enregistrement…" variant="secondary">
              Tout afficher
            </SubmitButton>
          )}
        </ActionForm>
      )}
    </div>
  );
}
