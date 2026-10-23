'use client';

import {
  canTransitionResponsibility,
  type ResponsibilityDto,
  type ResponsibilityLimitsCaps,
  type ResponsibilityStatus,
} from '@nagaw/shared';
import { useActionState } from 'react';
import { FormField, SelectField, TextareaField } from '@/components/form-field';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { initialFormState } from '@/lib/auth/schemas';
import { changeResponsibilityStatus, saveResponsibility } from './actions';

export interface Option {
  value: string;
  label: string;
}

export function ResponsibilityForm({
  organizationId,
  caps,
  agents,
  members,
  responsibility,
  defaultAgentId,
}: {
  organizationId: string;
  caps: ResponsibilityLimitsCaps;
  agents: Option[];
  members: Option[];
  responsibility?: ResponsibilityDto;
  defaultAgentId?: string;
}) {
  const [state, action] = useActionState(saveResponsibility, initialFormState);
  const errors = state.fieldErrors;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="organizationId" value={organizationId} />
      {responsibility && (
        <input
          type="hidden"
          name="responsibilityId"
          value={responsibility.id}
        />
      )}
      <FormMessage state={state} />
      <FormField
        label="Titre"
        name="title"
        defaultValue={responsibility?.title ?? ''}
        required
        minLength={3}
        maxLength={120}
        error={errors?.title}
      />
      <SelectField
        label="Agent responsable"
        name="agentId"
        defaultValue={
          responsibility?.agent.id ?? defaultAgentId ?? agents[0]?.value ?? ''
        }
        options={agents}
        error={errors?.agentId}
      />
      <TextareaField
        label="Objectif"
        name="objective"
        defaultValue={responsibility?.objective ?? ''}
        maxLength={2000}
        rows={3}
        error={errors?.objective}
      />
      <TextareaField
        label="Périmètre"
        name="scope"
        defaultValue={responsibility?.scope ?? ''}
        maxLength={2000}
        rows={2}
        hint="Ce qui entre, et n’entre pas, dans la responsabilité."
        error={errors?.scope}
      />
      <TextareaField
        label="Règles métier"
        name="rules"
        defaultValue={responsibility?.rules ?? ''}
        maxLength={5000}
        rows={4}
        error={errors?.rules}
      />
      <TextareaField
        label="Critères de réussite"
        name="successCriteria"
        defaultValue={responsibility?.successCriteria ?? ''}
        maxLength={2000}
        rows={2}
        error={errors?.successCriteria}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          label={`Exécutions maximum par jour (≤ ${caps.maxRunsPerDay})`}
          name="maxRunsPerDay"
          type="number"
          inputMode="numeric"
          min={1}
          max={caps.maxRunsPerDay}
          defaultValue={
            responsibility?.maxRunsPerDay ?? Math.min(4, caps.maxRunsPerDay)
          }
          required
          error={errors?.maxRunsPerDay}
        />
        <SelectField
          label="Personne à prévenir en cas de blocage"
          name="escalationUserId"
          defaultValue={responsibility?.escalation?.userId ?? ''}
          options={[{ value: '', label: 'Personne' }, ...members]}
          error={errors?.escalationUserId}
        />
        <FormField
          label="Début (facultatif)"
          name="startsOn"
          type="date"
          defaultValue={responsibility?.startsOn ?? ''}
          error={errors?.startsOn}
        />
        <FormField
          label="Fin (facultatif)"
          name="endsOn"
          type="date"
          defaultValue={responsibility?.endsOn ?? ''}
          error={errors?.endsOn}
        />
      </div>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Déclenchement manuel uniquement : une personne lance toujours le
        travail, rien n’est automatisé.
      </p>
      <div>
        <SubmitButton pendingLabel="Enregistrement…">
          {responsibility
            ? 'Enregistrer'
            : 'Créer la responsabilité (brouillon)'}
        </SubmitButton>
      </div>
    </form>
  );
}

const STATUS_ACTIONS: { to: ResponsibilityStatus; label: string }[] = [
  { to: 'active', label: 'Activer' },
  { to: 'suspended', label: 'Suspendre' },
  { to: 'archived', label: 'Archiver' },
];

export function ResponsibilityStatusActions({
  organizationId,
  responsibility,
}: {
  organizationId: string;
  responsibility: ResponsibilityDto;
}) {
  const [state, action] = useActionState(
    changeResponsibilityStatus,
    initialFormState,
  );
  const actions = STATUS_ACTIONS.filter(({ to }) =>
    canTransitionResponsibility(responsibility.status, to),
  );
  if (actions.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-start gap-2">
        {actions.map(({ to, label }) => (
          <form key={to} action={action} className="flex flex-col gap-1">
            <input type="hidden" name="organizationId" value={organizationId} />
            <input
              type="hidden"
              name="responsibilityId"
              value={responsibility.id}
            />
            <input type="hidden" name="status" value={to} />
            {to === 'archived' && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="confirm" required />
                Archivage définitif
              </label>
            )}
            <SubmitButton variant="secondary" pendingLabel="…">
              {label}
            </SubmitButton>
          </form>
        ))}
      </div>
      <FormMessage state={state} />
    </div>
  );
}
