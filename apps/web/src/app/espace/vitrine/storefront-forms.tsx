'use client';

import type { StorefrontSettingsDto } from '@nagaw/shared';
import { Check, Copy, MessageCircle, Share2 } from 'lucide-react';
import { useActionState, useState } from 'react';
import { ActionForm } from '@/components/action-form';
import { FormField } from '@/components/form-field';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { buttonClasses } from '@/components/ui/button-styles';
import { initialFormState } from '@/lib/auth/form-state';
import { saveStorefront, switchStorefront } from './actions';

/** On or off, in one touch (ADR-075). */
export function SwitchForm({
  organizationId,
  enabled,
}: {
  organizationId: string;
  enabled: boolean;
}) {
  const [state, action, pending] = useActionState(
    switchStorefront,
    initialFormState,
  );
  return (
    <ActionForm
      action={action}
      pending={pending}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="enabled" value={enabled ? 'false' : 'true'} />
      <FormMessage state={state} />
      <SubmitButton
        pendingLabel={enabled ? 'Extinction…' : 'Mise en ligne…'}
        variant={enabled ? 'secondary' : 'primary'}
      >
        {enabled ? 'Éteindre ma vitrine' : 'Mettre ma vitrine en ligne'}
      </SubmitButton>
    </ActionForm>
  );
}

/** What the customers see of the shop, and its address. */
export function PresentationForm({
  organizationId,
  settings,
  siteUrl,
}: {
  organizationId: string;
  settings: StorefrontSettingsDto;
  siteUrl: string;
}) {
  const [state, action, pending] = useActionState(
    saveStorefront,
    initialFormState,
  );
  const errors = state.fieldErrors ?? {};
  return (
    <ActionForm
      action={action}
      pending={pending}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <FormMessage state={state} />
      <FormField
        label="Mon lien"
        name="slug"
        defaultValue={settings.slug ?? settings.suggestedSlug}
        hint={`${siteUrl.replace(/^https?:\/\//, '')}/b/… — si vous le changez, l’ancien lien mène toujours ici.`}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        maxLength={40}
        required
        error={errors.slug}
      />
      <FormField
        label="Présentation"
        name="tagline"
        defaultValue={settings.tagline}
        hint="Une phrase : ce que vous vendez."
        maxLength={160}
        error={errors.tagline}
      />
      <FormField
        label="Où vous trouver"
        name="landmark"
        defaultValue={settings.landmark}
        hint="Un repère : « Marché HLM, allée 4 »."
        maxLength={120}
        error={errors.landmark}
      />
      <FormField
        label="Horaires"
        name="hours"
        defaultValue={settings.hours}
        hint="« Lundi au samedi, 9 h – 19 h »."
        maxLength={120}
        error={errors.hours}
      />
      <FormField
        label="Numéro WhatsApp"
        name="whatsapp"
        type="tel"
        inputMode="tel"
        defaultValue={settings.whatsapp}
        hint="Vide : le numéro de la boutique."
        maxLength={30}
        error={errors.whatsapp}
      />
      <label className="flex min-h-12 items-center gap-3 font-bold">
        <input
          type="checkbox"
          name="indexable"
          defaultChecked={settings.indexable}
          className="size-6 accent-brand-strong"
        />
        <span>
          Être trouvée sur Google
          <span className="block text-sm font-normal text-ink-muted">
            Sinon, seuls ceux qui ont le lien la voient.
          </span>
        </span>
      </label>
      <SubmitButton pendingLabel="Enregistrement…">Enregistrer</SubmitButton>
    </ActionForm>
  );
}

/** Share the link: the phone's menu, WhatsApp, or a copy. */
export function ShareActions({
  url,
  shopName,
}: {
  url: string;
  shopName: string;
}) {
  const [copied, setCopied] = useState(false);
  const message = `Découvrez ${shopName} et commandez ici : ${url}`;
  const share = async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: shopName, text: message, url });
        return;
      } catch (error) {
        // Closed by the person: nothing to do. Anything else: copy instead.
        if (error instanceof DOMException && error.name === 'AbortError')
          return;
        console.error('Partage impossible', error);
      }
    }
    await copy();
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      console.error('Copie du lien impossible', error);
      window.prompt('Copiez le lien de votre vitrine :', url);
    }
  };
  const round =
    'flex min-h-12 flex-col items-center gap-2 text-center text-sm font-bold';
  const disc =
    'flex size-14 items-center justify-center rounded-full bg-surface';
  return (
    <div className="grid grid-cols-3 gap-2">
      <button type="button" onClick={share} className={round}>
        <span className={disc} aria-hidden>
          <Share2 className="size-6" />
        </span>
        Partager le lien
      </button>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noreferrer"
        className={round}
      >
        <span className={disc} aria-hidden>
          <MessageCircle className="size-6" />
        </span>
        Sur WhatsApp
      </a>
      <button type="button" onClick={copy} className={round}>
        <span className={disc} aria-hidden>
          {copied ? <Check className="size-6" /> : <Copy className="size-6" />}
        </span>
        <span role="status">{copied ? 'Lien copié' : 'Copier le lien'}</span>
      </button>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className={`${buttonClasses('secondary')} col-span-3 mt-2`}
      >
        Voir ma vitrine
      </a>
    </div>
  );
}
