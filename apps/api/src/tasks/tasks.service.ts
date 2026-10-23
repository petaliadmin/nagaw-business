import { HttpStatus, Injectable } from '@nestjs/common';
import {
  canLaunchTask,
  canTransitionTask,
  canWorkOnTask,
  isTaskOpen,
  OPEN_TASK_STATUSES,
  TASK_STATUSES,
  type ChangeTaskStatusInput,
  type CreateTaskInput,
  type TaskHistoryEntryDto,
  type TaskDto,
  type TaskNoteDto,
  type TaskStatus,
  type TaskSummaryDto,
  type UpdateTaskInput,
} from '@nagaw/shared';
import { sql, type Kysely, type Transaction } from 'kysely';
import { AuditService } from '../audit/audit.service.js';
import { ApiException } from '../common/api-exception.js';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { today } from '../common/today.js';
import { DatabaseService } from '../database/database.service.js';
import type { Database } from '../database/schema.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Executor = Kysely<Database> | Transaction<Database>;

function taskNotFound(): ApiException {
  return new ApiException(
    HttpStatus.NOT_FOUND,
    'TASK_NOT_FOUND',
    'Tâche introuvable.',
  );
}

function denied(message: string): ApiException {
  return new ApiException(HttpStatus.FORBIDDEN, 'PERMISSION_DENIED', message);
}

function taskClosed(): ApiException {
  return new ApiException(
    HttpStatus.CONFLICT,
    'TASK_CLOSED',
    'Cette tâche est clôturée et ne peut plus être modifiée.',
  );
}

/** Field-level validation error, in the API's usual envelope. */
function invalid(path: string, message: string): ApiException {
  return new ApiException(
    HttpStatus.BAD_REQUEST,
    'VALIDATION_FAILED',
    'Données invalides.',
    [{ path, message }],
  );
}

/** Fields compared for the audit trail of an update. */
const AUDITED_FIELDS = [
  'assigneeUserId',
  'title',
  'description',
  'dueOn',
] as const;

export interface TaskListFilter {
  assigneeUserId?: string;
  responsibilityId?: string;
  /** A status, or `open` / `closed`. */
  status?: string;
}

@Injectable()
export class TasksService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  /** Tasks with their person in charge, author and responsibility. */
  private select(executor: Executor, organizationId: string) {
    return (
      executor
        .selectFrom('app.tasks as t')
        .innerJoin('app.organization_memberships as m', (join) =>
          join
            .onRef('m.user_id', '=', 't.assignee_user_id')
            .onRef('m.organization_id', '=', 't.organization_id'),
        )
        .innerJoin('app.user_profiles as a', 'a.id', 't.assignee_user_id')
        .innerJoin('app.user_profiles as c', 'c.id', 't.created_by')
        .leftJoin('app.responsibilities as r', (join) =>
          join
            .onRef('r.id', '=', 't.responsibility_id')
            .onRef('r.organization_id', '=', 't.organization_id'),
        )
        .leftJoin('app.user_profiles as e', 'e.id', 'r.escalation_user_id')
        .select([
          't.id',
          't.responsibility_id',
          'r.title as responsibility_title',
          't.title',
          't.description',
          't.assignee_user_id',
          'a.email as assignee_email',
          'a.display_name as assignee_display_name',
          'm.status as assignee_status',
          't.status',
          't.outcome',
          't.report',
          't.blocked_reason',
          'r.escalation_user_id',
          'e.email as escalation_email',
          't.created_by',
          'c.email as created_by_email',
          't.started_at',
          't.completed_at',
          't.created_at',
          't.updated_at',
        ])
        // Read back as text: no time-zone shift on calendar dates.
        .select(sql<string | null>`t.due_on::text`.as('due_on'))
        .where('t.organization_id', '=', organizationId)
    );
  }

  private toDto(
    row: Awaited<
      ReturnType<ReturnType<TasksService['select']>['execute']>
    >[number],
  ): TaskDto {
    return {
      id: row.id,
      responsibility:
        row.responsibility_id && row.responsibility_title
          ? { id: row.responsibility_id, title: row.responsibility_title }
          : null,
      title: row.title,
      description: row.description,
      assignee: {
        userId: row.assignee_user_id,
        email: row.assignee_email,
        displayName: row.assignee_display_name,
        status: row.assignee_status,
      },
      dueOn: row.due_on,
      status: row.status,
      outcome: row.outcome,
      report: row.report,
      blockedReason: row.blocked_reason,
      escalation:
        row.escalation_user_id && row.escalation_email
          ? { userId: row.escalation_user_id, email: row.escalation_email }
          : null,
      createdBy: { userId: row.created_by, email: row.created_by_email },
      startedAt: row.started_at?.toISOString() ?? null,
      completedAt: row.completed_at?.toISOString() ?? null,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  async list(
    organizationId: string,
    filter: TaskListFilter,
  ): Promise<TaskDto[]> {
    for (const id of [filter.assigneeUserId, filter.responsibilityId]) {
      if (id !== undefined && !UUID_RE.test(id)) return [];
    }
    let query = this.select(this.database.db, organizationId)
      .orderBy('t.created_at', 'desc')
      .limit(200);
    if (filter.assigneeUserId)
      query = query.where('t.assignee_user_id', '=', filter.assigneeUserId);
    if (filter.responsibilityId)
      query = query.where('t.responsibility_id', '=', filter.responsibilityId);
    if (filter.status === 'open') {
      query = query.where('t.status', 'in', [...OPEN_TASK_STATUSES]);
    } else if (filter.status === 'closed') {
      query = query.where('t.status', 'in', ['done', 'cancelled']);
    } else if (filter.status !== undefined) {
      if (!(TASK_STATUSES as readonly string[]).includes(filter.status))
        return [];
      query = query.where('t.status', '=', filter.status as TaskStatus);
    }
    return (await query.execute()).map((row) => this.toDto(row));
  }

  /** Counts for the overview, in the organization's time zone. */
  async summary(
    organizationId: string,
    userId: string,
  ): Promise<TaskSummaryDto> {
    const { timezone } = await this.database.db
      .selectFrom('app.organizations')
      .select('timezone')
      .where('id', '=', organizationId)
      .executeTakeFirstOrThrow();
    const open = [...OPEN_TASK_STATUSES];
    const row = await this.database.db
      .selectFrom('app.tasks')
      .select((eb) => [
        eb.fn.countAll<string>().filterWhere('status', '=', 'todo').as('todo'),
        eb.fn
          .countAll<string>()
          .filterWhere('status', '=', 'in_progress')
          .as('in_progress'),
        eb.fn
          .countAll<string>()
          .filterWhere('status', '=', 'blocked')
          .as('blocked'),
        eb.fn
          .countAll<string>()
          .filterWhere((w) =>
            w.and([w('status', 'in', open), w('due_on', '<', today(timezone))]),
          )
          .as('overdue'),
        eb.fn
          .countAll<string>()
          .filterWhere((w) =>
            w.and([
              w('status', 'in', open),
              w('assignee_user_id', '=', userId),
            ]),
          )
          .as('mine'),
      ])
      .where('organization_id', '=', organizationId)
      .executeTakeFirstOrThrow();
    return {
      todo: Number(row.todo),
      inProgress: Number(row.in_progress),
      blocked: Number(row.blocked),
      overdue: Number(row.overdue),
      mine: Number(row.mine),
    };
  }

  private async find(
    executor: Executor,
    organizationId: string,
    id: string,
  ): Promise<TaskDto> {
    if (!UUID_RE.test(id)) throw taskNotFound();
    const row = await this.select(executor, organizationId)
      .where('t.id', '=', id)
      .executeTakeFirst();
    if (!row) throw taskNotFound();
    return this.toDto(row);
  }

  get(organizationId: string, id: string): Promise<TaskDto> {
    return this.find(this.database.db, organizationId, id);
  }

  /** Locks the task row of this organization, then reads it. */
  private async lock(
    trx: Transaction<Database>,
    organizationId: string,
    id: string,
  ): Promise<TaskDto> {
    if (!UUID_RE.test(id)) throw taskNotFound();
    const locked = await trx
      .selectFrom('app.tasks')
      .select('id')
      .where('organization_id', '=', organizationId)
      .where('id', '=', id)
      .forUpdate()
      .executeTakeFirst();
    if (!locked) throw taskNotFound();
    return this.find(trx, organizationId, id);
  }

  /** The person in charge must be an active member of the organization. */
  private async assertActiveAssignee(
    executor: Executor,
    organizationId: string,
    userId: string,
  ): Promise<void> {
    const member = await executor
      .selectFrom('app.organization_memberships')
      .select('user_id')
      .where('organization_id', '=', organizationId)
      .where('user_id', '=', userId)
      .where('status', '=', 'active')
      .executeTakeFirst();
    if (!member) {
      throw invalid(
        'assigneeUserId',
        'La personne en charge doit être un membre actif de l’organisation.',
      );
    }
  }

  async create(
    tenant: TenantContext,
    user: AuthContext,
    input: CreateTaskInput,
    requestId: string | null,
  ): Promise<TaskDto> {
    return this.database.db.transaction().execute(async (trx) => {
      // Serializes task launches of one organization (caps checked below).
      const organization = await trx
        .selectFrom('app.organizations')
        .select(['timezone', 'max_open_tasks'])
        .where('id', '=', tenant.organizationId)
        .forUpdate()
        .executeTakeFirstOrThrow();
      const day = today(organization.timezone);

      const responsibility = input.responsibilityId
        ? await trx
            .selectFrom('app.responsibilities')
            .select(['id', 'assignee_user_id', 'status', 'max_runs_per_day'])
            .select([
              sql<string | null>`starts_on::text`.as('starts_on'),
              sql<string | null>`ends_on::text`.as('ends_on'),
            ])
            .where('organization_id', '=', tenant.organizationId)
            .where('id', '=', input.responsibilityId)
            .executeTakeFirst()
        : null;
      if (input.responsibilityId && !responsibility) {
        throw invalid('responsibilityId', 'Responsabilité inconnue.');
      }

      if (
        !canLaunchTask(
          { userId: user.userId, role: tenant.role },
          input,
          responsibility?.assignee_user_id ?? null,
        )
      ) {
        throw denied(
          'Vous ne pouvez lancer une tâche que pour vous-même, sur une responsabilité qui vous est confiée.',
        );
      }
      await this.assertActiveAssignee(
        trx,
        tenant.organizationId,
        input.assigneeUserId,
      );

      if (responsibility) {
        if (responsibility.status !== 'active') {
          throw new ApiException(
            HttpStatus.CONFLICT,
            'RESPONSIBILITY_NOT_ACTIVE',
            'La responsabilité doit être active pour lancer une tâche.',
          );
        }
        if (
          (responsibility.starts_on && responsibility.starts_on > day) ||
          (responsibility.ends_on && responsibility.ends_on < day)
        ) {
          throw new ApiException(
            HttpStatus.CONFLICT,
            'RESPONSIBILITY_OUT_OF_PERIOD',
            'La responsabilité n’est pas dans sa période d’application.',
          );
        }
        const { count } = await trx
          .selectFrom('app.tasks')
          .select((eb) => eb.fn.countAll<string>().as('count'))
          .where('responsibility_id', '=', responsibility.id)
          .where(
            sql<string>`(created_at at time zone ${organization.timezone})::date::text`,
            '=',
            day,
          )
          .executeTakeFirstOrThrow();
        if (Number(count) >= responsibility.max_runs_per_day) {
          throw new ApiException(
            HttpStatus.CONFLICT,
            'TASK_DAILY_LIMIT_REACHED',
            `Limite de ${responsibility.max_runs_per_day} tâches par jour atteinte pour cette responsabilité.`,
          );
        }
      }

      const { count: open } = await trx
        .selectFrom('app.tasks')
        .select((eb) => eb.fn.countAll<string>().as('count'))
        .where('organization_id', '=', tenant.organizationId)
        .where('status', 'in', [...OPEN_TASK_STATUSES])
        .executeTakeFirstOrThrow();
      if (Number(open) >= organization.max_open_tasks) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          'TASK_LIMIT_REACHED',
          `Limite de ${organization.max_open_tasks} tâches en cours atteinte. Clôturez-en avant d’en lancer de nouvelles.`,
        );
      }

      const { id } = await trx
        .insertInto('app.tasks')
        .values({
          organization_id: tenant.organizationId,
          responsibility_id: input.responsibilityId,
          title: input.title,
          description: input.description,
          assignee_user_id: input.assigneeUserId,
          due_on: input.dueOn,
          created_by: user.userId,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await this.audit.record(trx, {
        organizationId: tenant.organizationId,
        actorType: 'user',
        actorId: user.userId,
        action: 'task.created',
        targetType: 'task',
        targetId: id,
        metadata: {
          title: input.title,
          assigneeUserId: input.assigneeUserId,
          responsibilityId: input.responsibilityId,
        },
        requestId,
      });
      return this.find(trx, tenant.organizationId, id);
    });
  }

  async update(
    tenant: TenantContext,
    user: AuthContext,
    id: string,
    input: UpdateTaskInput,
    requestId: string | null,
  ): Promise<TaskDto> {
    return this.database.db.transaction().execute(async (trx) => {
      const before = await this.lock(trx, tenant.organizationId, id);
      if (!isTaskOpen(before.status)) throw taskClosed();
      if (input.assigneeUserId !== before.assignee.userId) {
        await this.assertActiveAssignee(
          trx,
          tenant.organizationId,
          input.assigneeUserId,
        );
      }
      await trx
        .updateTable('app.tasks')
        .set({
          assignee_user_id: input.assigneeUserId,
          title: input.title,
          description: input.description,
          due_on: input.dueOn,
        })
        .where('id', '=', id)
        .execute();
      const after = await this.find(trx, tenant.organizationId, id);

      const previous = { ...before, assigneeUserId: before.assignee.userId };
      const next = { ...after, assigneeUserId: after.assignee.userId };
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      for (const field of AUDITED_FIELDS) {
        if (previous[field] !== next[field]) {
          changes[field] = { from: previous[field], to: next[field] };
        }
      }
      if (Object.keys(changes).length > 0) {
        await this.audit.record(trx, {
          organizationId: tenant.organizationId,
          actorType: 'user',
          actorId: user.userId,
          action: 'task.updated',
          targetType: 'task',
          targetId: id,
          metadata: { changes },
          requestId,
        });
      }
      return after;
    });
  }

  async changeStatus(
    tenant: TenantContext,
    user: AuthContext,
    id: string,
    input: ChangeTaskStatusInput,
    requestId: string | null,
  ): Promise<TaskDto> {
    return this.database.db.transaction().execute(async (trx) => {
      const current = await this.lock(trx, tenant.organizationId, id);
      if (
        !canWorkOnTask(
          { userId: user.userId, role: tenant.role },
          { assigneeUserId: current.assignee.userId },
        )
      ) {
        throw denied(
          'Seule la personne en charge peut faire avancer la tâche.',
        );
      }
      if (!canTransitionTask(current.status, input.status)) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          'INVALID_STATUS_TRANSITION',
          'Ce changement de statut n’est pas possible.',
        );
      }

      const metadata: Record<string, unknown> = {
        from: current.status,
        to: input.status,
      };
      switch (input.status) {
        case 'in_progress':
          await trx
            .updateTable('app.tasks')
            .set({
              status: 'in_progress',
              blocked_reason: null,
              started_at: current.startedAt ?? sql<Date>`now()`,
            })
            .where('id', '=', id)
            .execute();
          break;
        case 'blocked':
          metadata.reason = input.reason;
          await trx
            .updateTable('app.tasks')
            .set({ status: 'blocked', blocked_reason: input.reason })
            .where('id', '=', id)
            .execute();
          break;
        case 'done':
          metadata.outcome = input.outcome;
          await trx
            .updateTable('app.tasks')
            .set({
              status: 'done',
              outcome: input.outcome,
              report: input.report,
              blocked_reason: null,
              completed_at: sql<Date>`now()`,
            })
            .where('id', '=', id)
            .execute();
          break;
        case 'cancelled':
          if (input.reason) metadata.reason = input.reason;
          await trx
            .updateTable('app.tasks')
            .set({
              status: 'cancelled',
              blocked_reason: null,
              completed_at: sql<Date>`now()`,
            })
            .where('id', '=', id)
            .execute();
          break;
      }
      await this.audit.record(trx, {
        organizationId: tenant.organizationId,
        actorType: 'user',
        actorId: user.userId,
        action: 'task.status_changed',
        targetType: 'task',
        targetId: id,
        metadata,
        requestId,
      });
      return this.find(trx, tenant.organizationId, id);
    });
  }

  async notes(organizationId: string, id: string): Promise<TaskNoteDto[]> {
    await this.get(organizationId, id);
    const rows = await this.database.db
      .selectFrom('app.task_notes as n')
      .innerJoin('app.user_profiles as p', 'p.id', 'n.author_id')
      .select(['n.id', 'n.author_id', 'p.email', 'n.body', 'n.created_at'])
      .where('n.organization_id', '=', organizationId)
      .where('n.task_id', '=', id)
      .orderBy('n.created_at', 'desc')
      .limit(200)
      .execute();
    return rows.map((row) => ({
      id: row.id,
      author: { userId: row.author_id, email: row.email },
      body: row.body,
      createdAt: row.created_at.toISOString(),
    }));
  }

  async addNote(
    tenant: TenantContext,
    user: AuthContext,
    id: string,
    body: string,
    requestId: string | null,
  ): Promise<TaskNoteDto> {
    return this.database.db.transaction().execute(async (trx) => {
      const task = await this.lock(trx, tenant.organizationId, id);
      if (
        !canWorkOnTask(
          { userId: user.userId, role: tenant.role },
          { assigneeUserId: task.assignee.userId },
        )
      ) {
        throw denied('Seule la personne en charge peut annoter la tâche.');
      }
      if (!isTaskOpen(task.status)) throw taskClosed();
      const note = await trx
        .insertInto('app.task_notes')
        .values({
          organization_id: tenant.organizationId,
          task_id: id,
          author_id: user.userId,
          body,
        })
        .returning(['id', 'created_at'])
        .executeTakeFirstOrThrow();
      await this.audit.record(trx, {
        organizationId: tenant.organizationId,
        actorType: 'user',
        actorId: user.userId,
        action: 'task.note_added',
        targetType: 'task',
        targetId: id,
        metadata: { noteId: note.id },
        requestId,
      });
      const author = await trx
        .selectFrom('app.user_profiles')
        .select('email')
        .where('id', '=', user.userId)
        .executeTakeFirstOrThrow();
      return {
        id: note.id,
        author: { userId: user.userId, email: author.email },
        body,
        createdAt: note.created_at.toISOString(),
      };
    });
  }

  /** Change history: the audit entries of this task. */
  async history(
    organizationId: string,
    id: string,
  ): Promise<TaskHistoryEntryDto[]> {
    await this.get(organizationId, id);
    const rows = await this.database.db
      .selectFrom('app.audit_logs as l')
      .leftJoin('app.user_profiles as p', 'p.id', 'l.actor_id')
      .select([
        'l.id',
        'l.action',
        'l.actor_id',
        'p.email',
        'l.metadata',
        'l.created_at',
      ])
      .where('l.organization_id', '=', organizationId)
      .where('l.target_type', '=', 'task')
      .where('l.target_id', '=', id)
      .orderBy('l.id', 'desc')
      .limit(100)
      .execute();
    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      actor:
        row.actor_id && row.email
          ? { userId: row.actor_id, email: row.email }
          : null,
      metadata: row.metadata,
      createdAt: row.created_at.toISOString(),
    }));
  }
}
