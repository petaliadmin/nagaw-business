'use client';

import { ROLES, type MemberDto, type Role } from '@nagaw/shared';
import { useActionState } from 'react';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { initialFormState } from '@/lib/auth/schemas';
import { ROLE_LABELS } from '@/lib/labels';
import { revokeInvitation, updateMember } from './actions';

/**
 * Role and access controls for one member. Only rendered when the shared
 * rules allow the change; the API applies the same rules regardless.
 */
export function MemberActions({
  organizationId,
  member,
  assignableRoles,
}: {
  organizationId: string;
  member: MemberDto;
  assignableRoles: Role[];
}) {
  const [roleState, roleAction] = useActionState(
    updateMember,
    initialFormState,
  );
  const [statusState, statusAction] = useActionState(
    updateMember,
    initialFormState,
  );
  const who = member.displayName ?? member.email;
  const selectId = `role-${member.userId}`;

  return (
    <div className="flex flex-col gap-2">
      <form action={roleAction} className="flex items-end gap-2">
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="userId" value={member.userId} />
        <div className="flex flex-col gap-1">
          <label htmlFor={selectId} className="sr-only">
            Rôle de {who}
          </label>
          <select
            id={selectId}
            name="role"
            defaultValue={member.role}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {ROLES.filter(
              (role) => role === member.role || assignableRoles.includes(role),
            ).map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </div>
        <SubmitButton
          variant="secondary"
          pendingLabel="…"
          aria-label={`Changer le rôle de ${who}`}
        >
          Changer
        </SubmitButton>
      </form>
      <FormMessage state={roleState} />
      <form action={statusAction}>
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="userId" value={member.userId} />
        <input
          type="hidden"
          name="status"
          value={member.status === 'active' ? 'disabled' : 'active'}
        />
        <SubmitButton
          variant="secondary"
          pendingLabel="…"
          aria-label={`${member.status === 'active' ? 'Désactiver' : 'Réactiver'} ${who}`}
        >
          {member.status === 'active' ? 'Désactiver' : 'Réactiver'}
        </SubmitButton>
      </form>
      <FormMessage state={statusState} />
    </div>
  );
}

export function RevokeInvitationButton({
  organizationId,
  invitationId,
  email,
}: {
  organizationId: string;
  invitationId: string;
  email: string;
}) {
  const [state, action] = useActionState(revokeInvitation, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="invitationId" value={invitationId} />
      <div>
        <SubmitButton
          variant="secondary"
          pendingLabel="Annulation…"
          aria-label={`Annuler l’invitation de ${email}`}
        >
          Annuler
        </SubmitButton>
      </div>
      {state.status === 'error' && <FormMessage state={state} />}
    </form>
  );
}
