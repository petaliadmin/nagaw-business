'use client';

import { INVITABLE_ROLES } from '@nagaw/shared';
import { useActionState, useState } from 'react';
import { FormField } from '@/components/form-field';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { formatDateTime } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/labels';
import { inviteMember, type InviteState } from './actions';

const initialState: InviteState = { status: 'idle' };

function InvitationLink({
  link,
  email,
  expiresAt,
  timeZone,
}: {
  link: string;
  email: string;
  expiresAt: string;
  timeZone: string;
}) {
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopy('copied');
    } catch (error) {
      // Clipboard access can be refused (permissions, insecure context):
      // the link stays selectable in the field below.
      console.warn('Copie du lien impossible', error);
      setCopy('failed');
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-900 dark:bg-emerald-950">
      <p>
        L’envoi automatique par e-mail n’est pas encore configuré : transmettez
        ce lien à {email}. Il n’est affiché qu’une fois et expire le{' '}
        {formatDateTime(expiresAt, timeZone)}.
      </p>
      <label htmlFor="invitation-link" className="font-medium">
        Lien d’invitation
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="invitation-link"
          readOnly
          value={link}
          onFocus={(event) => event.currentTarget.select()}
          className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="button"
          onClick={copyLink}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900"
        >
          Copier le lien
        </button>
      </div>
      <p role="status" className="min-h-5">
        {copy === 'copied' && 'Lien copié.'}
        {copy === 'failed' &&
          'Copie impossible : sélectionnez le lien et copiez-le manuellement.'}
      </p>
    </div>
  );
}

export function InviteForm({
  organizationId,
  timeZone,
}: {
  organizationId: string;
  timeZone: string;
}) {
  const [state, action] = useActionState(inviteMember, initialState);
  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="organizationId" value={organizationId} />
        {!state.link && <FormMessage state={state} />}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
          <FormField
            label="Adresse e-mail"
            name="email"
            type="email"
            autoComplete="off"
            required
            error={state.fieldErrors?.email}
          />
          <div className="flex flex-col gap-1">
            <label htmlFor="invite-role" className="text-sm font-medium">
              Rôle
            </label>
            <select
              id="invite-role"
              name="role"
              defaultValue="member"
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            >
              {INVITABLE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <SubmitButton pendingLabel="Création…">Inviter</SubmitButton>
        </div>
      </form>
      {state.link && state.email && state.expiresAt && (
        <InvitationLink
          key={state.link}
          link={state.link}
          email={state.email}
          expiresAt={state.expiresAt}
          timeZone={timeZone}
        />
      )}
    </div>
  );
}
