'use client';

import type { CatalogSettingsDto } from '@nagaw/shared';
import { Copy, MessageCircle } from 'lucide-react';
import { useActionState, useState } from 'react';
import { ActionForm } from '@/components/action-form';
import { FormField } from '@/components/form-field';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { buttonClasses } from '@/components/ui/button-styles';
import { initialFormState } from '@/lib/auth/schemas';
import { whatsappLink } from '@/lib/sales/ticket';
import { updateCatalogSettings } from '../actions';

/** The public page of the shop (ADR-063): open it, say where to pay. */
export function CatalogSettingsForm({
  organizationId,
  shopName,
  siteUrl,
  settings,
}: {
  organizationId: string;
  shopName: string;
  /** Address of this site, for the link to share. */
  siteUrl: string;
  settings: CatalogSettingsDto;
}) {
  const [state, action, pending] = useActionState(
    updateCatalogSettings,
    initialFormState,
  );
  const errors = state.fieldErrors ?? {};
  const link = `${siteUrl.replace(/\/$/, '')}/b/${settings.slug}`;
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch (error) {
      console.warn('Copie impossible', error);
      setCopied(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {settings.published && (
        <div className="flex flex-col gap-3 rounded-2xl bg-surface-muted p-4">
          <p className="text-base">
            Votre catalogue est en ligne :{' '}
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="font-bold break-all text-brand-ink underline underline-offset-4"
            >
              {link}
            </a>
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copy}
              className={buttonClasses('secondary')}
            >
              <Copy aria-hidden className="size-5" />
              {copied ? 'Lien copié' : 'Copier le lien'}
            </button>
            <a
              href={whatsappLink(`Commandez chez ${shopName} ici : ${link}`)}
              target="_blank"
              rel="noreferrer"
              className={buttonClasses('secondary')}
            >
              <MessageCircle aria-hidden className="size-5" />
              Partager sur WhatsApp
            </a>
          </div>
          <p role="status" className="sr-only">
            {copied ? 'Lien copié' : ''}
          </p>
        </div>
      )}
      {settings.maxOrdersPerMonth !== null && (
        <p className="text-base">
          Ce mois-ci : {settings.ordersThisMonth} commande
          {settings.ordersThisMonth > 1 ? 's' : ''} sur{' '}
          {settings.maxOrdersPerMonth} avec votre offre.
        </p>
      )}
      <ActionForm
        action={action}
        pending={pending}
        className="flex flex-col gap-4"
      >
        <FormMessage state={state} />
        <input type="hidden" name="organizationId" value={organizationId} />
        <label className="flex min-h-12 items-center gap-3 text-base font-semibold">
          <input
            type="checkbox"
            name="published"
            defaultChecked={settings.published}
            className="size-6 accent-brand-strong"
          />
          Mettre mon catalogue en ligne
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label="Mon numéro Wave"
            name="waveNumber"
            inputMode="tel"
            maxLength={20}
            defaultValue={settings.waveNumber}
            hint="Le client paie sur ce numéro, avec la référence."
            error={errors.waveNumber}
          />
          <FormField
            label="Mon numéro Orange Money"
            name="orangeMoneyNumber"
            inputMode="tel"
            maxLength={20}
            defaultValue={settings.orangeMoneyNumber}
            error={errors.orangeMoneyNumber}
          />
        </div>
        <FormField
          label="Un mot pour vos clients"
          name="note"
          maxLength={300}
          defaultValue={settings.note}
          hint="Par exemple : livraison à Dakar et environs, du lundi au samedi."
          error={errors.note}
        />
        <p className="text-ink-muted">
          Le catalogue montre le nom, la photo et le prix de vente. Jamais vos
          prix d’achat, vos quantités ni vos clients. Un produit peut en sortir
          depuis sa fiche.
        </p>
        <SubmitButton pendingLabel="Enregistrement…">
          Enregistrer le catalogue
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
