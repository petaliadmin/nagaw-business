'use client';

import type { WaveAccountDto } from '@nagaw/shared';
import { useActionState } from 'react';
import { ActionForm } from '@/components/action-form';
import { FormField } from '@/components/form-field';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { initialFormState } from '@/lib/auth/schemas';
import { connectWave, disconnectWave } from '../actions';

/**
 * The shop's own Wave Business account (ADR-065): the money of an order
 * paid online goes there. The key leaves this page for the API and is
 * never shown again.
 */
export function WaveAccountForm({
  organizationId,
  account,
  apiUrl,
}: {
  organizationId: string;
  account: WaveAccountDto;
  /** Address of the API, for the optional webhook. */
  apiUrl: string;
}) {
  const [state, action, pending] = useActionState(
    connectWave,
    initialFormState,
  );
  const [removeState, remove, removing] = useActionState(
    disconnectWave,
    initialFormState,
  );
  const errors = state.fieldErrors ?? {};
  const webhookUrl = `${apiUrl.replace(/\/$/, '')}${account.webhookPath}`;

  if (account.connected)
    return (
      <div className="flex flex-col gap-4">
        <FormMessage state={removeState} />
        <p className="text-base">
          Compte Wave relié (clé finissant par{' '}
          <span className="font-bold">{account.keyHint}</span>). Vos clients
          voient « Payer avec Wave » après leur commande, et la commande passe
          en « Payée » quand Wave confirme.
        </p>
        {!account.webhook && (
          <p className="text-ink-muted">
            Sans webhook, Nagaw demande à Wave quand le client revient, ou quand
            vous touchez « Vérifier le paiement Wave » sur la commande.
          </p>
        )}
        <ActionForm action={remove} pending={removing}>
          <input type="hidden" name="organizationId" value={organizationId} />
          <SubmitButton pendingLabel="Retrait…" variant="secondary">
            Retirer le compte Wave
          </SubmitButton>
        </ActionForm>
      </div>
    );

  return (
    <ActionForm
      action={action}
      pending={pending}
      className="flex flex-col gap-4"
    >
      <FormMessage state={state} />
      <input type="hidden" name="organizationId" value={organizationId} />
      <ol className="flex list-decimal flex-col gap-1 pl-5 text-base">
        <li>
          Ouvrez <span className="font-bold">business.wave.com</span> avec le
          compte administrateur de la boutique.
        </li>
        <li>
          Dans « Développeurs », créez une clé d’API avec l’accès au paiement
          (Checkout).
        </li>
        <li>Copiez la clé et collez-la ici. Wave ne la montre qu’une fois.</li>
      </ol>
      <FormField
        label="Clé d’API Wave"
        name="apiKey"
        type="password"
        autoComplete="off"
        spellCheck={false}
        required
        placeholder="wave_sn_prod_…"
        error={errors.apiKey}
      />
      <details className="rounded-2xl border border-line p-4">
        <summary className="flex min-h-12 cursor-pointer items-center text-base font-bold">
          Options avancées
        </summary>
        <div className="mt-4 flex flex-col gap-4">
          <FormField
            label="Secret de signature (si la clé le demande)"
            name="signingSecret"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="wave_sn_AKS_…"
            error={errors.signingSecret}
          />
          <div className="flex flex-col gap-1">
            <p className="text-base">
              Webhook, facultatif : dans « Développeurs → Webhooks », ajoutez
              l’adresse ci-dessous avec l’événement « checkout.session.completed
              », puis collez le secret que Wave affiche.
            </p>
            <p className="font-mono text-base break-all">{webhookUrl}</p>
          </div>
          <FormField
            label="Secret du webhook"
            name="webhookSecret"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="wave_sn_WHS_…"
            error={errors.webhookSecret}
          />
        </div>
      </details>
      <SubmitButton pendingLabel="Vérification auprès de Wave…">
        Relier mon compte Wave
      </SubmitButton>
    </ActionForm>
  );
}
