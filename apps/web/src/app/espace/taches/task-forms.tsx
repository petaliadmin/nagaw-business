'use client';

import { canTransitionTask, TASK_OUTCOMES, type TaskDto } from '@nagaw/shared';
import { useActionState } from 'react';
import { FormField, SelectField, TextareaField } from '@/components/form-field';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { initialFormState } from '@/lib/auth/schemas';
import { TASK_OUTCOME_LABELS } from '@/lib/labels';
import { addTaskNote, changeTaskStatus, saveTask } from './actions';

export interface Option {
  value: string;
  label: string;
}

/** A responsibility a task can be launched on, with its person in charge. */
export interface ResponsibilityOption extends Option {
  assigneeUserId: string;
}

function Hidden({ name, value }: { name: string; value: string }) {
  return <input type="hidden" name={name} value={value} />;
}

/** Launches a task, or edits one when `task` is given. */
export function TaskForm({
  organizationId,
  members,
  responsibilities,
  task,
  defaultResponsibilityId,
  defaultAssigneeId,
}: {
  organizationId: string;
  members: Option[];
  responsibilities?: ResponsibilityOption[];
  task?: TaskDto;
  defaultResponsibilityId?: string;
  defaultAssigneeId?: string;
}) {
  const [state, action] = useActionState(saveTask, initialFormState);
  const errors = state.fieldErrors;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Hidden name="organizationId" value={organizationId} />
      {task && <Hidden name="taskId" value={task.id} />}
      <FormMessage state={state} />
      <FormField
        label="Titre"
        name="title"
        defaultValue={task?.title ?? ''}
        required
        minLength={3}
        maxLength={160}
        error={errors?.title}
      />
      {responsibilities && (
        <SelectField
          label="Responsabilité"
          name="responsibilityId"
          defaultValue={defaultResponsibilityId ?? ''}
          options={[
            { value: '', label: 'Aucune (tâche ponctuelle)' },
            ...responsibilities,
          ]}
          error={errors?.responsibilityId}
        />
      )}
      <SelectField
        label="Personne en charge"
        name="assigneeUserId"
        defaultValue={
          task?.assignee.userId ?? defaultAssigneeId ?? members[0]?.value ?? ''
        }
        options={members}
        error={errors?.assigneeUserId}
      />
      <TextareaField
        label="Description (facultatif)"
        name="description"
        defaultValue={task?.description ?? ''}
        maxLength={5000}
        rows={3}
        error={errors?.description}
      />
      <FormField
        label="Échéance (facultatif)"
        name="dueOn"
        type="date"
        defaultValue={task?.dueOn ?? ''}
        error={errors?.dueOn}
      />
      <div>
        <SubmitButton pendingLabel="Enregistrement…">
          {task ? 'Enregistrer' : 'Lancer la tâche'}
        </SubmitButton>
      </div>
    </form>
  );
}

/** The next steps of a task, each with what it requires. */
export function TaskStatusActions({
  organizationId,
  task,
}: {
  organizationId: string;
  task: TaskDto;
}) {
  const [state, action] = useActionState(changeTaskStatus, initialFormState);
  const errors = state.fieldErrors;
  const can = (to: TaskDto['status']) => canTransitionTask(task.status, to);
  if (
    !can('in_progress') &&
    !can('blocked') &&
    !can('done') &&
    !can('cancelled')
  )
    return null;
  const common = (
    <>
      <Hidden name="organizationId" value={organizationId} />
      <Hidden name="taskId" value={task.id} />
    </>
  );
  return (
    <div className="flex flex-col gap-4">
      <FormMessage state={state} />
      {can('in_progress') && (
        <form action={action}>
          {common}
          <Hidden name="status" value="in_progress" />
          <SubmitButton pendingLabel="…">
            {task.status === 'blocked' ? 'Reprendre' : 'Démarrer'}
          </SubmitButton>
        </form>
      )}
      {can('done') && (
        <form
          action={action}
          className="flex flex-col gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
          aria-label="Terminer la tâche"
          noValidate
        >
          {common}
          <Hidden name="status" value="done" />
          <SelectField
            label="Résultat"
            name="outcome"
            defaultValue="achieved"
            options={TASK_OUTCOMES.map((outcome) => ({
              value: outcome,
              label: TASK_OUTCOME_LABELS[outcome],
            }))}
            error={errors?.outcome}
          />
          <TextareaField
            label="Compte rendu"
            name="report"
            maxLength={5000}
            rows={3}
            required
            hint="Ce qui a été fait, au regard des critères de réussite."
            error={errors?.report}
          />
          <div>
            <SubmitButton pendingLabel="…">Terminer</SubmitButton>
          </div>
        </form>
      )}
      {can('blocked') && (
        <form
          action={action}
          className="flex flex-col gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
          aria-label="Signaler un blocage"
          noValidate
        >
          {common}
          <Hidden name="status" value="blocked" />
          <TextareaField
            label="Motif du blocage"
            name="reason"
            maxLength={1000}
            rows={2}
            required
            hint={
              task.escalation
                ? `Prévenez ${task.escalation.email} : aucun message n’est envoyé automatiquement.`
                : undefined
            }
            error={errors?.reason}
          />
          <div>
            <SubmitButton variant="secondary" pendingLabel="…">
              Signaler un blocage
            </SubmitButton>
          </div>
        </form>
      )}
      {can('cancelled') && (
        <form
          action={action}
          className="flex flex-col gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
          aria-label="Annuler la tâche"
        >
          {common}
          <Hidden name="status" value="cancelled" />
          <FormField
            label="Motif de l’annulation (facultatif)"
            name="cancelReason"
            maxLength={1000}
            error={errors?.cancelReason}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="confirm" required />
            Annulation définitive
          </label>
          <div>
            <SubmitButton variant="secondary" pendingLabel="…">
              Annuler la tâche
            </SubmitButton>
          </div>
        </form>
      )}
    </div>
  );
}

export function TaskNoteForm({
  organizationId,
  taskId,
}: {
  organizationId: string;
  taskId: string;
}) {
  const [state, action] = useActionState(addTaskNote, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <Hidden name="organizationId" value={organizationId} />
      <Hidden name="taskId" value={taskId} />
      <FormMessage state={state} />
      <TextareaField
        label="Nouvelle note"
        name="body"
        maxLength={5000}
        rows={2}
        required
        error={state.fieldErrors?.body}
      />
      <div>
        <SubmitButton variant="secondary" pendingLabel="…">
          Ajouter la note
        </SubmitButton>
      </div>
    </form>
  );
}
