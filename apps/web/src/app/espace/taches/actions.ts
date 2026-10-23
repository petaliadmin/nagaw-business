'use server';

import {
  addTaskNoteSchema,
  changeTaskStatusSchema,
  createTaskSchema,
  updateTaskSchema,
  type TaskDto,
  type TaskNoteDto,
} from '@nagaw/shared';
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiErrorState } from '@/lib/api/form-error';
import { apiAsUser, getSession } from '@/lib/api/server';
import { parseValues, type FormState } from '@/lib/auth/schemas';

async function requireToken() {
  const session = await getSession();
  if (session.status !== 'signed-in') redirect('/connexion');
  return session.accessToken;
}

function text(formData: FormData, name: string): string {
  return formData.get(name)?.toString() ?? '';
}

function taskPath(formData: FormData): string {
  return `/tasks/${encodeURIComponent(text(formData, 'taskId'))}`;
}

/** Creates a task (then opens it) or replaces its editable fields. */
export async function saveTask(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const accessToken = await requireToken();
  const organizationId = text(formData, 'organizationId');
  const taskId = text(formData, 'taskId');
  const fields = {
    assigneeUserId: text(formData, 'assigneeUserId'),
    title: text(formData, 'title'),
    description: text(formData, 'description'),
    dueOn: text(formData, 'dueOn'),
  };
  const parsed = taskId
    ? parseValues(updateTaskSchema, fields)
    : parseValues(createTaskSchema, {
        responsibilityId: text(formData, 'responsibilityId'),
        ...fields,
      });
  if (!parsed.ok) return parsed.state;

  const result = await apiAsUser<TaskDto>(accessToken, {
    method: taskId ? 'PUT' : 'POST',
    path: taskId ? taskPath(formData) : '/tasks',
    organizationId,
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);
  if (!taskId) redirect(`/espace/taches/${result.data.id}`);
  refresh();
  return { status: 'success', message: 'Tâche enregistrée.' };
}

const STATUS_MESSAGES: Record<string, string> = {
  in_progress: 'Tâche en cours.',
  blocked: 'Blocage signalé.',
  done: 'Tâche terminée.',
  cancelled: 'Tâche annulée.',
};

export async function changeTaskStatus(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const accessToken = await requireToken();
  const status = text(formData, 'status');
  // Each status form sends only the fields it needs (strict schemas).
  const values =
    status === 'blocked'
      ? { status, reason: text(formData, 'reason') }
      : status === 'done'
        ? {
            status,
            outcome: text(formData, 'outcome'),
            report: text(formData, 'report'),
          }
        : status === 'cancelled'
          ? { status, reason: text(formData, 'cancelReason') }
          : { status };
  const parsed = parseValues(changeTaskStatusSchema, values);
  if (!parsed.ok) {
    // The cancel form names its reason field `cancelReason`.
    const reasonError = parsed.state.fieldErrors?.reason;
    if (status === 'cancelled' && reasonError) {
      return {
        ...parsed.state,
        fieldErrors: { cancelReason: reasonError },
      };
    }
    return parsed.state;
  }

  const result = await apiAsUser<TaskDto>(accessToken, {
    method: 'POST',
    path: `${taskPath(formData)}/status`,
    organizationId: text(formData, 'organizationId'),
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);
  refresh();
  return { status: 'success', message: STATUS_MESSAGES[status] };
}

export async function addTaskNote(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const accessToken = await requireToken();
  const parsed = parseValues(addTaskNoteSchema, {
    body: text(formData, 'body'),
  });
  if (!parsed.ok) return parsed.state;

  const result = await apiAsUser<TaskNoteDto>(accessToken, {
    method: 'POST',
    path: `${taskPath(formData)}/notes`,
    organizationId: text(formData, 'organizationId'),
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);
  refresh();
  return { status: 'success', message: 'Note ajoutée.' };
}
