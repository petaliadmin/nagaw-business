'use client';

import type { NotificationSettingsDto } from '@nagaw/shared';
import { useActionState } from 'react';
import { ActionForm } from '@/components/action-form';
import { FormField } from '@/components/form-field';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { initialFormState } from '@/lib/auth/schemas';
import { updateNotificationSettings } from '../notifications/actions';

/** The shop's thresholds for alerts and for sellers' stock corrections. */
export function NotificationSettingsForm({
  organizationId,
  settings,
}: {
  organizationId: string;
  settings: NotificationSettingsDto;
}) {
  const [state, action, pending] = useActionState(
    updateNotificationSettings,
    initialFormState,
  );
  const errors = state.fieldErrors ?? {};
  const field = (
    name: Exclude<keyof NotificationSettingsDto, 'sellerCanSellBelowCost'>,
    label: string,
    hint: string,
  ) => (
    <FormField
      label={label}
      name={name}
      id={`alerts-${name}`}
      inputMode="numeric"
      defaultValue={String(settings[name])}
      hint={hint}
      error={errors[name]}
    />
  );
  return (
    <ActionForm
      action={action}
      pending={pending}
      className="flex flex-col gap-4"
      noValidate
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <FormMessage state={state} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {field(
          'sellerStockCorrectionMax',
          'Correction de stock permise aux vendeurs',
          'Quantité la plus grande qu’un vendeur peut ajouter ou retirer à la caisse. 0 : seuls vous et les gérants corrigez le stock.',
        )}
        {field(
          'dailySummaryHour',
          'Heure du résumé du soir',
          'De 0 à 23 h, à l’heure de la boutique.',
        )}
        {field(
          'stockForecastDays',
          'Prévenir quand le stock tient moins de (jours)',
          'Au rythme des ventes récentes.',
        )}
        {field(
          'stockForecastWindowDays',
          'Rythme calculé sur les derniers (jours)',
          'Entre 3 et 90 jours.',
        )}
        {field(
          'creditNearLimitPercent',
          'Prévenir quand un client atteint (% de son plafond)',
          'Pour les clients qui ont un plafond de crédit.',
        )}
        {field(
          'creditOverdueDays',
          'Crédit en retard après (jours sans remboursement)',
          'Entre 1 et 365 jours.',
        )}
      </div>
      <label className="flex min-h-12 items-start gap-3">
        <input
          type="checkbox"
          name="sellerCanSellBelowCost"
          defaultChecked={settings.sellerCanSellBelowCost}
          className="mt-1 size-6 shrink-0"
        />
        <span>
          <span className="block font-semibold">
            Les vendeurs peuvent vendre sous le prix d’achat
          </span>
          <span className="block text-ink-muted">
            Sinon, une vente à perte doit être faite par vous ou un gérant. Les
            gérants sont prévenus de chaque vente à perte.
          </span>
        </span>
      </label>
      <div>
        <SubmitButton pendingLabel="Enregistrement…">
          Enregistrer les réglages
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
