'use client';

import { useActionState, useState } from 'react';
import { ActionForm } from '@/components/action-form';
import { CONTROL, SelectField } from '@/components/form-field';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { initialFormState, type FormState } from '@/lib/auth/schemas';
import { sendFeedback } from './actions';

export function FeedbackForm({
  organizationId,
  page,
}: {
  organizationId: string;
  page: string;
}) {
  const [state, action, pending] = useActionState(
    sendFeedback,
    initialFormState,
  );
  const [operationId, setOperationId] = useState(() => crypto.randomUUID());
  const [handled, setHandled] = useState<FormState>(state);
  if (state !== handled) {
    setHandled(state);
    if (state.status === 'success') setOperationId(crypto.randomUUID());
  }
  const errors = state.fieldErrors ?? {};
  return (
    <div className="flex flex-col gap-4">
      <FormMessage state={state} />
      <ActionForm
        key={operationId}
        action={action}
        pending={pending}
        noValidate
        className="flex flex-col gap-4"
      >
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="clientOperationId" value={operationId} />
        <input type="hidden" name="page" value={page} />
        <SelectField
          label="De quoi s’agit-il ?"
          name="kind"
          id="feedback-kind"
          defaultValue="problem"
          options={[
            { value: 'problem', label: 'Quelque chose ne marche pas' },
            { value: 'idea', label: 'Une idée pour améliorer' },
            { value: 'question', label: 'Une question' },
          ]}
          error={errors.kind}
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="feedback-message" className="text-base font-semibold">
            Votre message
          </label>
          <textarea
            id="feedback-message"
            name="message"
            rows={5}
            maxLength={2000}
            aria-invalid={errors.message ? true : undefined}
            aria-describedby={
              errors.message ? 'feedback-message-error' : undefined
            }
            placeholder="Dites ce que vous faisiez et ce qui s’est passé."
            className={`${CONTROL} py-3`}
          />
          {errors.message && (
            <p
              id="feedback-message-error"
              className="text-base font-medium text-danger-ink"
            >
              {errors.message}
            </p>
          )}
        </div>
        <div>
          <SubmitButton pendingLabel="Envoi…">Envoyer</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
