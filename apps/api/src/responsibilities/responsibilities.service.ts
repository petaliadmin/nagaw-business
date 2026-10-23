import { HttpStatus, Injectable } from '@nestjs/common';
import {
  canTransitionResponsibility,
  responsibilityActivationBlockers,
  type AgentStatus,
  type CreateResponsibilityInput,
  type ResponsibilityDto,
  type ResponsibilityHistoryEntryDto,
  type ResponsibilityLimitsCaps,
  type ResponsibilityStatus,
} from '@nagaw/shared';
import { sql, type Kysely, type Transaction } from 'kysely';
import { AuditService } from '../audit/audit.service.js';
import { ApiException } from '../common/api-exception.js';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { DatabaseService } from '../database/database.service.js';
import type { Database } from '../database/schema.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Executor = Kysely<Database> | Transaction<Database>;

function responsibilityNotFound(): ApiException {
  return new ApiException(
    HttpStatus.NOT_FOUND,
    'RESPONSIBILITY_NOT_FOUND',
    'Responsabilité introuvable.',
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

/** Today in the organization's time zone, as YYYY-MM-DD. */
function today(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
}

/** Fields compared for the audit trail of an update. */
const AUDITED_FIELDS = [
  'agentId',
  'title',
  'objective',
  'scope',
  'rules',
  'successCriteria',
  'maxRunsPerDay',
  'escalationUserId',
  'startsOn',
  'endsOn',
] as const;

@Injectable()
export class ResponsibilitiesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  async caps(
    organizationId: string,
    executor: Executor = this.database.db,
  ): Promise<ResponsibilityLimitsCaps & { timezone: string }> {
    const row = await executor
      .selectFrom('app.organizations')
      .select([
        'max_responsibilities',
        'responsibility_max_runs_per_day',
        'timezone',
      ])
      .where('id', '=', organizationId)
      .executeTakeFirstOrThrow();
    return {
      maxResponsibilities: row.max_responsibilities,
      maxRunsPerDay: row.responsibility_max_runs_per_day,
      timezone: row.timezone,
    };
  }

  /** Responsibilities with their agent and escalation contact. */
  private select(executor: Executor, organizationId: string) {
    return (
      executor
        .selectFrom('app.responsibilities as r')
        .innerJoin('app.agents as a', (join) =>
          join
            .onRef('a.id', '=', 'r.agent_id')
            .onRef('a.organization_id', '=', 'r.organization_id'),
        )
        .leftJoin('app.user_profiles as e', 'e.id', 'r.escalation_user_id')
        .select([
          'r.id',
          'r.title',
          'r.objective',
          'r.scope',
          'r.rules',
          'r.success_criteria',
          'r.max_runs_per_day',
          'r.escalation_user_id',
          'e.email as escalation_email',
          'r.status',
          'r.created_at',
          'r.updated_at',
          'a.id as agent_id',
          'a.name as agent_name',
          'a.status as agent_status',
        ])
        // Read back as text: no time-zone shift on calendar dates.
        .select([
          sql<string | null>`r.starts_on::text`.as('starts_on'),
          sql<string | null>`r.ends_on::text`.as('ends_on'),
        ])
        .where('r.organization_id', '=', organizationId)
    );
  }

  private toDto(
    row: Awaited<
      ReturnType<ReturnType<ResponsibilitiesService['select']>['execute']>
    >[number],
  ): ResponsibilityDto {
    return {
      id: row.id,
      agent: {
        id: row.agent_id,
        name: row.agent_name,
        status: row.agent_status,
      },
      title: row.title,
      objective: row.objective,
      scope: row.scope,
      rules: row.rules,
      successCriteria: row.success_criteria,
      maxRunsPerDay: row.max_runs_per_day,
      escalation:
        row.escalation_user_id && row.escalation_email
          ? { userId: row.escalation_user_id, email: row.escalation_email }
          : null,
      startsOn: row.starts_on,
      endsOn: row.ends_on,
      status: row.status,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  async list(
    organizationId: string,
    options: { agentId?: string; includeArchived: boolean },
  ): Promise<ResponsibilityDto[]> {
    if (options.agentId !== undefined && !UUID_RE.test(options.agentId)) {
      return [];
    }
    let query = this.select(this.database.db, organizationId).orderBy(
      'r.created_at',
      'asc',
    );
    if (options.agentId)
      query = query.where('r.agent_id', '=', options.agentId);
    if (!options.includeArchived)
      query = query.where('r.status', '<>', 'archived');
    return (await query.execute()).map((row) => this.toDto(row));
  }

  private async find(
    executor: Executor,
    organizationId: string,
    id: string,
  ): Promise<ResponsibilityDto> {
    if (!UUID_RE.test(id)) throw responsibilityNotFound();
    const row = await this.select(executor, organizationId)
      .where('r.id', '=', id)
      .executeTakeFirst();
    if (!row) throw responsibilityNotFound();
    return this.toDto(row);
  }

  get(organizationId: string, id: string): Promise<ResponsibilityDto> {
    return this.find(this.database.db, organizationId, id);
  }

  /** The agent must exist in the organization and not be archived. */
  private async agentStatus(
    executor: Executor,
    organizationId: string,
    agentId: string,
  ): Promise<AgentStatus> {
    const agent = await executor
      .selectFrom('app.agents')
      .select('status')
      .where('organization_id', '=', organizationId)
      .where('id', '=', agentId)
      .executeTakeFirst();
    if (!agent) throw invalid('agentId', 'Agent introuvable.');
    if (agent.status === 'archived') {
      throw invalid('agentId', 'Cet agent est archivé.');
    }
    return agent.status;
  }

  /** The escalation contact must be an active member of the organization. */
  private async assertEscalation(
    executor: Executor,
    organizationId: string,
    userId: string | null,
  ): Promise<void> {
    if (!userId) return;
    const member = await executor
      .selectFrom('app.organization_memberships')
      .select('user_id')
      .where('organization_id', '=', organizationId)
      .where('user_id', '=', userId)
      .where('status', '=', 'active')
      .executeTakeFirst();
    if (!member) {
      throw invalid(
        'escalationUserId',
        'La personne à prévenir doit être un membre actif.',
      );
    }
  }

  private assertRunsCap(
    input: CreateResponsibilityInput,
    caps: ResponsibilityLimitsCaps,
  ): void {
    if (input.maxRunsPerDay > caps.maxRunsPerDay) {
      throw invalid(
        'maxRunsPerDay',
        `Au plus ${caps.maxRunsPerDay} exécutions par jour dans cette organisation.`,
      );
    }
  }

  private assertActivatable(
    input: CreateResponsibilityInput,
    agentStatus: AgentStatus,
    caps: ResponsibilityLimitsCaps & { timezone: string },
  ): void {
    const blockers = responsibilityActivationBlockers(
      input,
      agentStatus,
      caps,
      today(caps.timezone),
    );
    if (blockers.length > 0) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'RESPONSIBILITY_NOT_READY',
        'La responsabilité ne peut pas être active en l’état.',
        blockers.map((check) => ({ path: check.code, message: check.message })),
      );
    }
  }

  private columns(input: CreateResponsibilityInput) {
    return {
      agent_id: input.agentId,
      title: input.title,
      objective: input.objective,
      scope: input.scope,
      rules: input.rules,
      success_criteria: input.successCriteria,
      max_runs_per_day: input.maxRunsPerDay,
      escalation_user_id: input.escalationUserId,
      starts_on: input.startsOn,
      ends_on: input.endsOn,
    };
  }

  async create(
    tenant: TenantContext,
    user: AuthContext,
    input: CreateResponsibilityInput,
    requestId: string | null,
  ): Promise<ResponsibilityDto> {
    return this.database.db.transaction().execute(async (trx) => {
      // Serializes creations of one organization (quota check below).
      await trx
        .selectFrom('app.organizations')
        .select('id')
        .where('id', '=', tenant.organizationId)
        .forUpdate()
        .executeTakeFirstOrThrow();
      const caps = await this.caps(tenant.organizationId, trx);
      await this.agentStatus(trx, tenant.organizationId, input.agentId);
      await this.assertEscalation(
        trx,
        tenant.organizationId,
        input.escalationUserId,
      );
      this.assertRunsCap(input, caps);

      const { count } = await trx
        .selectFrom('app.responsibilities')
        .select((eb) => eb.fn.countAll<string>().as('count'))
        .where('organization_id', '=', tenant.organizationId)
        .where('status', '<>', 'archived')
        .executeTakeFirstOrThrow();
      if (Number(count) >= caps.maxResponsibilities) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          'RESPONSIBILITY_LIMIT_REACHED',
          `Limite de ${caps.maxResponsibilities} responsabilités atteinte. Archivez-en une avant d’en créer une nouvelle.`,
        );
      }

      const { id } = await trx
        .insertInto('app.responsibilities')
        .values({
          organization_id: tenant.organizationId,
          created_by: user.userId,
          ...this.columns(input),
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await this.audit.record(trx, {
        organizationId: tenant.organizationId,
        actorType: 'user',
        actorId: user.userId,
        action: 'responsibility.created',
        targetType: 'responsibility',
        targetId: id,
        metadata: { title: input.title, agentId: input.agentId },
        requestId,
      });
      return this.find(trx, tenant.organizationId, id);
    });
  }

  async update(
    tenant: TenantContext,
    user: AuthContext,
    id: string,
    input: CreateResponsibilityInput,
    requestId: string | null,
  ): Promise<ResponsibilityDto> {
    return this.database.db.transaction().execute(async (trx) => {
      if (!UUID_RE.test(id)) throw responsibilityNotFound();
      const locked = await trx
        .selectFrom('app.responsibilities')
        .select('id')
        .where('organization_id', '=', tenant.organizationId)
        .where('id', '=', id)
        .forUpdate()
        .executeTakeFirst();
      if (!locked) throw responsibilityNotFound();
      const before = await this.find(trx, tenant.organizationId, id);
      if (before.status === 'archived') {
        throw new ApiException(
          HttpStatus.CONFLICT,
          'RESPONSIBILITY_ARCHIVED',
          'Cette responsabilité est archivée et ne peut plus être modifiée.',
        );
      }
      const caps = await this.caps(tenant.organizationId, trx);
      const agentStatus = await this.agentStatus(
        trx,
        tenant.organizationId,
        input.agentId,
      );
      await this.assertEscalation(
        trx,
        tenant.organizationId,
        input.escalationUserId,
      );
      this.assertRunsCap(input, caps);
      if (before.status === 'active') {
        // An active responsibility never runs on an incomplete definition.
        this.assertActivatable(input, agentStatus, caps);
      }

      await trx
        .updateTable('app.responsibilities')
        .set(this.columns(input))
        .where('id', '=', id)
        .execute();
      const after = await this.find(trx, tenant.organizationId, id);

      const previous = {
        ...before,
        agentId: before.agent.id,
        escalationUserId: before.escalation?.userId ?? null,
      };
      const next = {
        ...after,
        agentId: after.agent.id,
        escalationUserId: after.escalation?.userId ?? null,
      };
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      for (const field of AUDITED_FIELDS) {
        if (JSON.stringify(previous[field]) !== JSON.stringify(next[field])) {
          changes[field] = { from: previous[field], to: next[field] };
        }
      }
      if (Object.keys(changes).length > 0) {
        await this.audit.record(trx, {
          organizationId: tenant.organizationId,
          actorType: 'user',
          actorId: user.userId,
          action: 'responsibility.updated',
          targetType: 'responsibility',
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
    status: ResponsibilityStatus,
    requestId: string | null,
  ): Promise<ResponsibilityDto> {
    return this.database.db.transaction().execute(async (trx) => {
      if (!UUID_RE.test(id)) throw responsibilityNotFound();
      const locked = await trx
        .selectFrom('app.responsibilities')
        .select('id')
        .where('organization_id', '=', tenant.organizationId)
        .where('id', '=', id)
        .forUpdate()
        .executeTakeFirst();
      if (!locked) throw responsibilityNotFound();
      const current = await this.find(trx, tenant.organizationId, id);
      if (!canTransitionResponsibility(current.status, status)) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          'INVALID_STATUS_TRANSITION',
          'Ce changement de statut n’est pas possible.',
        );
      }
      if (status === 'active') {
        this.assertActivatable(
          {
            ...current,
            agentId: current.agent.id,
            escalationUserId: current.escalation?.userId ?? null,
          },
          current.agent.status,
          await this.caps(tenant.organizationId, trx),
        );
      }
      await trx
        .updateTable('app.responsibilities')
        .set({ status })
        .where('id', '=', id)
        .execute();
      await this.audit.record(trx, {
        organizationId: tenant.organizationId,
        actorType: 'user',
        actorId: user.userId,
        action: 'responsibility.status_changed',
        targetType: 'responsibility',
        targetId: id,
        metadata: { from: current.status, to: status },
        requestId,
      });
      return this.find(trx, tenant.organizationId, id);
    });
  }

  /** Change history: the audit entries of this responsibility. */
  async history(
    organizationId: string,
    id: string,
  ): Promise<ResponsibilityHistoryEntryDto[]> {
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
      .where('l.target_type', '=', 'responsibility')
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
