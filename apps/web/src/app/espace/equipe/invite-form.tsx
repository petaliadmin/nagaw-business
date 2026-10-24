'use client';

import { INVITABLE_ROLES } from '@nagaw/shared';
import { CircleCheck, Copy } from 'lucide-react';
import { useActionState, useState } from 'react';
import { CONTROL, FormField, SelectField } from '@/components/form-field';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { buttonClasses } from '@/components/ui/button-styles';
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
    <div className="flex flex-col gap-3 rounded-2xl border-l-4 border-sales bg-sales-soft p-4 text-base">
      <p className="flex items-center gap-2 text-lg font-bold text-sales-ink">
        <CircleCheck aria-hidden className="size-6 shrink-0" />
        Invitation créée
      </p>
      <p>
        L’envoi automatique par e-mail n’est pas encore configuré : transmettez
        ce lien à {email}. Il n’est affiché qu’une fois et expire le{' '}
        {formatDateTime(expiresAt, timeZone)}.
      </p>
      <label htmlFor="invitation-link" className="font-semibold">
        Lien d’invitation
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="invitation-link"
          readOnly
          value={link}
          onFocus={(event) => event.currentTarget.select()}
          className={`${CONTROL} min-w-0 flex-1 font-mono`}
        />
        <button
          type="button"
          onClick={copyLink}
          className={buttonClasses('primary')}
        >
          <Copy aria-hidden className="size-5" />
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
          <SelectField
            label="Rôle"
            name="role"
            defaultValue="member"
            options={INVITABLE_ROLES.map((role) => ({
              value: role,
              label: ROLE_LABELS[role],
            }))}
          />
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
