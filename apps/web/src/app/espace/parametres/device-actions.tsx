'use client';

import { useActionState } from 'react';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { initialFormState } from '@/lib/auth/schemas';
import { restoreDevice, revokeDevice } from '../vendre/actions';

/** Brings a withdrawn device back: it opens the checkout and sends again. */
export function RestoreDeviceButton({
  organizationId,
  deviceId,
  label,
}: {
  organizationId: string;
  deviceId: string;
  label: string;
}) {
  const [state, action] = useActionState(restoreDevice, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="deviceId" value={deviceId} />
      <FormMessage state={state} />
      <div>
        <SubmitButton
          variant="secondary"
          pendingLabel="…"
          aria-label={`Remettre l’appareil ${label}`}
        >
          Remettre cet appareil
        </SubmitButton>
      </div>
    </form>
  );
}

/** Withdraws a device, after confirmation: it can no longer send sales. */
export function RevokeDeviceButton({
  organizationId,
  deviceId,
  label,
}: {
  organizationId: string;
  deviceId: string;
  label: string;
}) {
  const [state, action] = useActionState(revokeDevice, initialFormState);
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Retirer « ${label} » ? Sa caisse se ferme dès qu’il se connecte, et ses ventes pas encore envoyées seront refusées.`,
          )
        )
          event.preventDefault();
      }}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="deviceId" value={deviceId} />
      <FormMessage state={state} />
      <div>
        <SubmitButton
          variant="secondary"
          pendingLabel="…"
          aria-label={`Retirer l’appareil ${label}`}
        >
          Retirer cet appareil
        </SubmitButton>
      </div>
    </form>
  );
}
