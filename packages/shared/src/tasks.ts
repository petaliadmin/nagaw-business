import { z } from 'zod';
import type { MemberStatus } from './members.js';
import { roleHasPermission, type Role } from './permissions.js';
import type { ResponsibilityHistoryEntryDto } from './responsibilities.js';

/**
 * Manual task tracking (ADR-017): a person launches a task, records what
 * was done and closes it. Nothing runs automatically.
 */
export const TASK_STATUSES = [
  'todo',
  'in_progress',
  'blocked',
  'done',
  'cancelled',
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** Statuses of a task still to be finished. */
export const OPEN_TASK_STATUSES = [
  'todo',
  'in_progress',
  'blocked',
] as const satisfies readonly TaskStatus[];

export const TASK_OUTCOMES = ['achieved', 'partial', 'not_achieved'] as const;
export type TaskOutcome = (typeof TASK_OUTCOMES)[number];

const text = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label} : au moins ${min} caractères`)
    .max(max, `${label} : au plus ${max} caractères`);

/** Empty form inputs become null; anything else must be a valid value. */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (value) => (value === '' || value === undefined ? null : value),
    schema.nullable(),
  );

const taskFields = {
  assigneeUserId: z.uuid('Membre inconnu'),
  title: text(3, 160, 'Titre'),
  description: text(0, 5000, 'Description'),
  dueOn: optional(z.iso.date('Date au format AAAA-MM-JJ attendue')),
};

export const createTaskSchema = z
  .object({
    /** Null for a one-off task. */
    responsibilityId: optional(z.uuid('Responsabilité inconnue')),
    ...taskFields,
  })
  .strict();
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

/** Full replacement of the editable fields; the responsibility is fixed. */
export const updateTaskSchema = z.object(taskFields).strict();
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const changeTaskStatusSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('in_progress') }).strict(),
  z
    .object({
      status: z.literal('blocked'),
      reason: text(3, 1000, 'Motif du blocage'),
    })
    .strict(),
  z
    .object({
      status: z.literal('done'),
      outcome: z.enum(TASK_OUTCOMES, 'Indiquez le résultat'),
      report: text(3, 5000, 'Compte rendu'),
    })
    .strict(),
  z
    .object({
      status: z.literal('cancelled'),
      reason: text(0, 1000, 'Motif'),
    })
    .strict(),
]);
export type ChangeTaskStatusInput = z.infer<typeof changeTaskStatusSchema>;

export const addTaskNoteSchema = z
  .object({ body: text(1, 5000, 'Note') })
  .strict();
export type AddTaskNoteInput = z.infer<typeof addTaskNoteSchema>;

export interface TaskLimitsCaps {
  maxOpenTasks: number;
}

export interface TaskDto {
  id: string;
  responsibility: { id: string; title: string } | null;
  title: string;
  description: string;
  assignee: {
    userId: string;
    email: string;
    displayName: string | null;
    status: MemberStatus;
  };
  dueOn: string | null;
  status: TaskStatus;
  outcome: TaskOutcome | null;
  report: string;
  blockedReason: string | null;
  /** Who to warn when the task is blocked (from the responsibility). */
  escalation: { userId: string; email: string } | null;
  createdBy: { userId: string; email: string };
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskNoteDto {
  id: string;
  author: { userId: string; email: string };
  body: string;
  createdAt: string;
}

/** Audit entries of a task, same shape as a responsibility's history. */
export type TaskHistoryEntryDto = ResponsibilityHistoryEntryDto;

export interface TaskSummaryDto {
  todo: number;
  inProgress: number;
  blocked: number;
  overdue: number;
  /** Open tasks of the caller. */
  mine: number;
}

const TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  todo: ['in_progress', 'cancelled'],
  in_progress: ['blocked', 'done', 'cancelled'],
  blocked: ['in_progress', 'cancelled'],
  done: [],
  cancelled: [],
};

export function canTransitionTask(from: TaskStatus, to: TaskStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isTaskOpen(status: TaskStatus): boolean {
  return (OPEN_TASK_STATUSES as readonly TaskStatus[]).includes(status);
}

/** Open and past its due date (`today` in the organization's time zone). */
export function isTaskOverdue(
  task: Pick<TaskDto, 'status' | 'dueOn'>,
  today: string,
): boolean {
  return isTaskOpen(task.status) && task.dueOn !== null && task.dueOn < today;
}

export interface TaskActor {
  userId: string;
  role: Role;
}

/**
 * Who may launch a task: managers for anyone; a member only for themself,
 * as a one-off task or on a responsibility entrusted to them.
 */
export function canLaunchTask(
  actor: TaskActor,
  input: { assigneeUserId: string },
  responsibilityAssigneeId: string | null,
): boolean {
  if (roleHasPermission(actor.role, 'tasks.manage')) return true;
  if (!roleHasPermission(actor.role, 'tasks.work')) return false;
  return (
    input.assigneeUserId === actor.userId &&
    (responsibilityAssigneeId === null ||
      responsibilityAssigneeId === actor.userId)
  );
}

/** Who may move a task forward or add a note: managers, or its assignee. */
export function canWorkOnTask(
  actor: TaskActor,
  task: { assigneeUserId: string },
): boolean {
  if (roleHasPermission(actor.role, 'tasks.manage')) return true;
  return (
    roleHasPermission(actor.role, 'tasks.work') &&
    task.assigneeUserId === actor.userId
  );
}
