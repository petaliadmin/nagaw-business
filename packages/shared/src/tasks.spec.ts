import { describe, expect, it } from 'vitest';
import { roleHasPermission } from './permissions.js';
import {
  canLaunchTask,
  canTransitionTask,
  canWorkOnTask,
  changeTaskStatusSchema,
  createTaskSchema,
  isTaskOverdue,
  TASK_STATUSES,
} from './tasks.js';

const ME = '0b9a6f3e-3f0d-4c62-9f2a-1d2b3c4d5e6f';
const OTHER = '1c8b7a6d-4e1f-4d73-8a3b-2e3c4d5e6f70';

describe('createTaskSchema', () => {
  it('accepts a one-off task and turns empty inputs into null', () => {
    const parsed = createTaskSchema.parse({
      responsibilityId: '',
      assigneeUserId: ME,
      title: '  Préparer la réunion  ',
      description: '',
      dueOn: '',
    });
    expect(parsed).toEqual({
      responsibilityId: null,
      assigneeUserId: ME,
      title: 'Préparer la réunion',
      description: '',
      dueOn: null,
    });
  });

  it('refuses server-owned fields and invalid dates', () => {
    const base = { assigneeUserId: ME, title: 'Relance', description: '' };
    expect(
      createTaskSchema.safeParse({ ...base, status: 'done' }).success,
    ).toBe(false);
    expect(
      createTaskSchema.safeParse({ ...base, dueOn: '24/10/2026' }).success,
    ).toBe(false);
  });
});

describe('changeTaskStatusSchema', () => {
  it('requires an outcome and a report to finish a task', () => {
    expect(changeTaskStatusSchema.safeParse({ status: 'done' }).success).toBe(
      false,
    );
    expect(
      changeTaskStatusSchema.safeParse({
        status: 'done',
        outcome: 'achieved',
        report: 'Trois devis relancés.',
      }).success,
    ).toBe(true);
  });

  it('requires a reason to block a task and nothing else to start it', () => {
    expect(
      changeTaskStatusSchema.safeParse({ status: 'blocked', reason: '' })
        .success,
    ).toBe(false);
    expect(
      changeTaskStatusSchema.safeParse({ status: 'in_progress' }).success,
    ).toBe(true);
    expect(
      changeTaskStatusSchema.safeParse({ status: 'in_progress', reason: 'x' })
        .success,
    ).toBe(false);
  });
});

describe('task life cycle', () => {
  it('goes from to-do to done through in progress, and ends there', () => {
    expect(canTransitionTask('todo', 'in_progress')).toBe(true);
    expect(canTransitionTask('todo', 'done')).toBe(false);
    expect(canTransitionTask('in_progress', 'blocked')).toBe(true);
    expect(canTransitionTask('blocked', 'in_progress')).toBe(true);
    expect(canTransitionTask('in_progress', 'done')).toBe(true);
    for (const to of TASK_STATUSES) {
      expect(canTransitionTask('done', to)).toBe(false);
      expect(canTransitionTask('cancelled', to)).toBe(false);
    }
  });

  it('flags open tasks past their due date only', () => {
    const today = '2026-10-24';
    expect(isTaskOverdue({ status: 'todo', dueOn: '2026-10-23' }, today)).toBe(
      true,
    );
    expect(isTaskOverdue({ status: 'todo', dueOn: today }, today)).toBe(false);
    expect(isTaskOverdue({ status: 'done', dueOn: '2026-10-01' }, today)).toBe(
      false,
    );
    expect(isTaskOverdue({ status: 'blocked', dueOn: null }, today)).toBe(
      false,
    );
  });
});

describe('task permissions', () => {
  it('lets managers launch and work on any task', () => {
    for (const role of ['owner', 'admin'] as const) {
      const actor = { userId: ME, role };
      expect(canLaunchTask(actor, { assigneeUserId: OTHER }, OTHER)).toBe(true);
      expect(canWorkOnTask(actor, { assigneeUserId: OTHER })).toBe(true);
    }
  });

  it('lets a member launch tasks only for themself, on their own responsibilities', () => {
    const actor = { userId: ME, role: 'member' as const };
    expect(canLaunchTask(actor, { assigneeUserId: ME }, null)).toBe(true);
    expect(canLaunchTask(actor, { assigneeUserId: ME }, ME)).toBe(true);
    expect(canLaunchTask(actor, { assigneeUserId: ME }, OTHER)).toBe(false);
    expect(canLaunchTask(actor, { assigneeUserId: OTHER }, null)).toBe(false);
    expect(canWorkOnTask(actor, { assigneeUserId: ME })).toBe(true);
    expect(canWorkOnTask(actor, { assigneeUserId: OTHER })).toBe(false);
  });

  it('keeps viewers read-only', () => {
    const actor = { userId: ME, role: 'viewer' as const };
    expect(roleHasPermission('viewer', 'tasks.read')).toBe(true);
    expect(canLaunchTask(actor, { assigneeUserId: ME }, null)).toBe(false);
    expect(canWorkOnTask(actor, { assigneeUserId: ME })).toBe(false);
  });
});
