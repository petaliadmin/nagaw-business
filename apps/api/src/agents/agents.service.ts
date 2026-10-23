import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  AGENT_ROLE_LABELS,
  buildAgentBrief,
  canTransition,
  checkAgentConfiguration,
  ERROR_POLICY_LABELS,
  TOOL_KEYS,
  TOOL_REGISTRY,
  type AgentConfigurationInput,
  type AgentDto,
  type AgentLimitsCaps,
  type AgentStatus,
  type AgentTestReportDto,
  type AgentVersionDto,
  type CreateAgentInput,
  type ToolKey,
  type UpdateAgentInput,
} from '@nagaw/shared';
import { sql, type Kysely, type Selectable, type Transaction } from 'kysely';
import { AuditService } from '../audit/audit.service.js';
import { ApiException } from '../common/api-exception.js';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { DatabaseService } from '../database/database.service.js';
import { pgErrorCode, UNIQUE_VIOLATION } from '../database/pg-errors.js';
import type {
  AgentsTable,
  AgentVersionsTable,
  Database,
} from '../database/schema.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Executor = Kysely<Database> | Transaction<Database>;
type VersionRow = Selectable<AgentVersionsTable> & { creator_email: string };

function agentNotFound(): ApiException {
  return new ApiException(
    HttpStatus.NOT_FOUND,
    'AGENT_NOT_FOUND',
    'Agent introuvable.',
  );
}

function toVersionDto(row: VersionRow): AgentVersionDto {
  return {
    id: row.id,
    version: row.version,
    instructions: row.instructions,
    objectives: row.objectives,
    maxSteps: row.max_steps,
    maxDurationSeconds: row.max_duration_seconds,
    errorPolicy: row.error_policy,
    // Only registry keys are ever written (validated on input).
    tools: row.tools.filter((tool): tool is ToolKey =>
      (TOOL_KEYS as string[]).includes(tool),
    ),
    createdAt: row.created_at.toISOString(),
    createdBy: { userId: row.created_by, email: row.creator_email },
  };
}

function toAgentDto(
  agent: Selectable<AgentsTable>,
  version: VersionRow,
): AgentDto {
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    roleKey: agent.role_key,
    status: agent.status,
    createdAt: agent.created_at.toISOString(),
    updatedAt: agent.updated_at.toISOString(),
    currentVersion: toVersionDto(version),
  };
}

function sameConfiguration(
  version: Selectable<AgentVersionsTable>,
  input: AgentConfigurationInput,
): boolean {
  return (
    version.instructions === input.instructions &&
    version.objectives === input.objectives &&
    version.max_steps === input.maxSteps &&
    version.max_duration_seconds === input.maxDurationSeconds &&
    version.error_policy === input.errorPolicy &&
    [...version.tools].sort().join(',') === [...input.tools].sort().join(',')
  );
}

@Injectable()
export class AgentsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  async caps(
    organizationId: string,
    executor: Executor = this.database.db,
  ): Promise<AgentLimitsCaps> {
    const row = await executor
      .selectFrom('app.organizations')
      .select(['max_agents', 'agent_max_steps', 'agent_max_duration_seconds'])
      .where('id', '=', organizationId)
      .executeTakeFirstOrThrow();
    return {
      maxAgents: row.max_agents,
      maxSteps: row.agent_max_steps,
      maxDurationSeconds: row.agent_max_duration_seconds,
    };
  }

  private versions(executor: Executor) {
    return executor
      .selectFrom('app.agent_versions as v')
      .innerJoin('app.user_profiles as p', 'p.id', 'v.created_by')
      .selectAll('v')
      .select('p.email as creator_email');
  }

  async list(
    organizationId: string,
    includeArchived: boolean,
  ): Promise<AgentDto[]> {
    let query = this.database.db
      .selectFrom('app.agents')
      .selectAll()
      .where('organization_id', '=', organizationId)
      .orderBy('created_at', 'asc');
    if (!includeArchived) query = query.where('status', '<>', 'archived');
    const agents = await query.execute();
    if (agents.length === 0) return [];
    const versions = await this.versions(this.database.db)
      .where('v.organization_id', '=', organizationId)
      .where(
        'v.id',
        'in',
        agents.map((agent) => agent.current_version_id),
      )
      .execute();
    const byId = new Map(versions.map((version) => [version.id, version]));
    return agents.map((agent) => {
      const version = byId.get(agent.current_version_id);
      if (!version) throw new Error(`Agent ${agent.id} without its version`);
      return toAgentDto(agent, version);
    });
  }

  /** The agent, looked up inside the caller's organization only. */
  private async findAgent(
    executor: Executor,
    organizationId: string,
    agentId: string,
    lock = false,
  ): Promise<Selectable<AgentsTable>> {
    if (!UUID_RE.test(agentId)) throw agentNotFound();
    let query = executor
      .selectFrom('app.agents')
      .selectAll()
      .where('organization_id', '=', organizationId)
      .where('id', '=', agentId);
    if (lock) query = query.forUpdate();
    const agent = await query.executeTakeFirst();
    if (!agent) throw agentNotFound();
    return agent;
  }

  private async currentVersion(
    executor: Executor,
    agent: Selectable<AgentsTable>,
  ): Promise<VersionRow> {
    return this.versions(executor)
      .where('v.id', '=', agent.current_version_id)
      .where('v.agent_id', '=', agent.id)
      .executeTakeFirstOrThrow();
  }

  async get(organizationId: string, agentId: string): Promise<AgentDto> {
    const agent = await this.findAgent(
      this.database.db,
      organizationId,
      agentId,
    );
    return toAgentDto(
      agent,
      await this.currentVersion(this.database.db, agent),
    );
  }

  async listVersions(
    organizationId: string,
    agentId: string,
  ): Promise<AgentVersionDto[]> {
    const agent = await this.findAgent(
      this.database.db,
      organizationId,
      agentId,
    );
    const rows = await this.versions(this.database.db)
      .where('v.agent_id', '=', agent.id)
      .orderBy('v.version', 'desc')
      .execute();
    return rows.map(toVersionDto);
  }

  /**
   * Save-time rules: limits within the organization's caps and only tools
   * that exist. Incomplete instructions are allowed in drafts; they only
   * block activation.
   */
  private assertSavable(
    configuration: AgentConfigurationInput,
    caps: AgentLimitsCaps,
  ): void {
    const details: { path: string; message: string }[] = [];
    if (configuration.maxSteps > caps.maxSteps) {
      details.push({
        path: 'maxSteps',
        message: `Au plus ${caps.maxSteps} étapes dans cette organisation.`,
      });
    }
    if (configuration.maxDurationSeconds > caps.maxDurationSeconds) {
      details.push({
        path: 'maxDurationSeconds',
        message: `Au plus ${caps.maxDurationSeconds} secondes dans cette organisation.`,
      });
    }
    configuration.tools.forEach((tool, index) => {
      if (!TOOL_REGISTRY[tool].available) {
        details.push({
          path: `tools.${index}`,
          message: `L’outil « ${TOOL_REGISTRY[tool].label} » n’est pas encore disponible.`,
        });
      }
    });
    if (details.length > 0) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_FAILED',
        'Configuration invalide.',
        details,
      );
    }
  }

  async create(
    tenant: TenantContext,
    user: AuthContext,
    input: CreateAgentInput,
    requestId: string | null,
  ): Promise<AgentDto> {
    try {
      return await this.database.db.transaction().execute(async (trx) => {
        // Serializes creations of one organization (quota check below).
        await trx
          .selectFrom('app.organizations')
          .select('id')
          .where('id', '=', tenant.organizationId)
          .forUpdate()
          .executeTakeFirstOrThrow();
        const caps = await this.caps(tenant.organizationId, trx);
        this.assertSavable(input.configuration, caps);

        const { count } = await trx
          .selectFrom('app.agents')
          .select((eb) => eb.fn.countAll<string>().as('count'))
          .where('organization_id', '=', tenant.organizationId)
          .where('status', '<>', 'archived')
          .executeTakeFirstOrThrow();
        if (Number(count) >= caps.maxAgents) {
          throw new ApiException(
            HttpStatus.CONFLICT,
            'AGENT_LIMIT_REACHED',
            `Limite de ${caps.maxAgents} agents atteinte. Archivez-en un avant d’en créer un nouveau.`,
          );
        }

        const versionId = randomUUID();
        const agent = await trx
          .insertInto('app.agents')
          .values({
            organization_id: tenant.organizationId,
            name: input.name,
            description: input.description,
            role_key: input.roleKey,
            current_version_id: versionId,
            created_by: user.userId,
          })
          .returningAll()
          .executeTakeFirstOrThrow();
        await this.insertVersion(
          trx,
          agent,
          versionId,
          1,
          input.configuration,
          user,
        );

        await this.audit.record(trx, {
          organizationId: tenant.organizationId,
          actorType: 'user',
          actorId: user.userId,
          action: 'agent.created',
          targetType: 'agent',
          targetId: agent.id,
          metadata: { name: agent.name, roleKey: agent.role_key },
          requestId,
        });
        return toAgentDto(agent, await this.currentVersion(trx, agent));
      });
    } catch (error) {
      throw this.nameConflict(error);
    }
  }

  private async insertVersion(
    trx: Transaction<Database>,
    agent: Selectable<AgentsTable>,
    id: string,
    version: number,
    configuration: AgentConfigurationInput,
    user: AuthContext,
  ): Promise<void> {
    await trx
      .insertInto('app.agent_versions')
      .values({
        id,
        organization_id: agent.organization_id,
        agent_id: agent.id,
        version,
        instructions: configuration.instructions,
        objectives: configuration.objectives,
        max_steps: configuration.maxSteps,
        max_duration_seconds: configuration.maxDurationSeconds,
        error_policy: configuration.errorPolicy,
        tools: sql<string[]>`${configuration.tools}::text[]`,
        created_by: user.userId,
      })
      .execute();
  }

  private nameConflict(error: unknown): unknown {
    if (pgErrorCode(error) === UNIQUE_VIOLATION) {
      return new ApiException(
        HttpStatus.CONFLICT,
        'AGENT_NAME_TAKEN',
        'Un agent porte déjà ce nom dans l’organisation.',
      );
    }
    return error;
  }

  private assertNotArchived(agent: Selectable<AgentsTable>): void {
    if (agent.status === 'archived') {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'AGENT_ARCHIVED',
        'Cet agent est archivé et ne peut plus être modifié.',
      );
    }
  }

  async update(
    tenant: TenantContext,
    user: AuthContext,
    agentId: string,
    input: UpdateAgentInput,
    requestId: string | null,
  ): Promise<AgentDto> {
    try {
      return await this.database.db.transaction().execute(async (trx) => {
        const before = await this.findAgent(
          trx,
          tenant.organizationId,
          agentId,
          true,
        );
        this.assertNotArchived(before);
        const after = await trx
          .updateTable('app.agents')
          .set({
            ...(input.name !== undefined && { name: input.name }),
            ...(input.description !== undefined && {
              description: input.description,
            }),
            ...(input.roleKey !== undefined && { role_key: input.roleKey }),
          })
          .where('id', '=', before.id)
          .returningAll()
          .executeTakeFirstOrThrow();

        const changes: Record<string, { from: unknown; to: unknown }> = {};
        if (before.name !== after.name)
          changes.name = { from: before.name, to: after.name };
        if (before.description !== after.description)
          changes.description = {
            from: before.description,
            to: after.description,
          };
        if (before.role_key !== after.role_key)
          changes.roleKey = { from: before.role_key, to: after.role_key };
        if (Object.keys(changes).length > 0) {
          await this.audit.record(trx, {
            organizationId: tenant.organizationId,
            actorType: 'user',
            actorId: user.userId,
            action: 'agent.updated',
            targetType: 'agent',
            targetId: after.id,
            metadata: { changes },
            requestId,
          });
        }
        return toAgentDto(after, await this.currentVersion(trx, after));
      });
    } catch (error) {
      throw this.nameConflict(error);
    }
  }

  /** Appends a configuration version and makes it current. */
  async configure(
    tenant: TenantContext,
    user: AuthContext,
    agentId: string,
    input: AgentConfigurationInput,
    requestId: string | null,
  ): Promise<AgentDto> {
    return this.database.db.transaction().execute(async (trx) => {
      const agent = await this.findAgent(
        trx,
        tenant.organizationId,
        agentId,
        true,
      );
      this.assertNotArchived(agent);
      const current = await this.currentVersion(trx, agent);
      if (sameConfiguration(current, input)) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          'CONFIGURATION_UNCHANGED',
          'Aucune modification par rapport à la version actuelle.',
        );
      }
      const caps = await this.caps(tenant.organizationId, trx);
      this.assertSavable(input, caps);
      if (agent.status === 'active') {
        // An active agent never runs on an incomplete configuration.
        this.assertReady(agent, input, caps);
      }

      const { latest } = await trx
        .selectFrom('app.agent_versions')
        .select((eb) => eb.fn.max('version').as('latest'))
        .where('agent_id', '=', agent.id)
        .executeTakeFirstOrThrow();
      const version = Number(latest) + 1;
      const versionId = randomUUID();
      await this.insertVersion(trx, agent, versionId, version, input, user);
      const updated = await trx
        .updateTable('app.agents')
        .set({ current_version_id: versionId })
        .where('id', '=', agent.id)
        .returningAll()
        .executeTakeFirstOrThrow();

      await this.audit.record(trx, {
        organizationId: tenant.organizationId,
        actorType: 'user',
        actorId: user.userId,
        action: 'agent.configured',
        targetType: 'agent',
        targetId: agent.id,
        metadata: { version, previousVersion: current.version },
        requestId,
      });
      return toAgentDto(updated, await this.currentVersion(trx, updated));
    });
  }

  private assertReady(
    agent: { status: AgentStatus },
    configuration: AgentConfigurationInput,
    caps: AgentLimitsCaps,
  ): void {
    const errors = checkAgentConfiguration(agent, configuration, caps).filter(
      (check) => check.severity === 'error',
    );
    if (errors.length > 0) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'AGENT_NOT_READY',
        'La configuration de l’agent est incomplète.',
        errors.map((check) => ({ path: check.code, message: check.message })),
      );
    }
  }

  async changeStatus(
    tenant: TenantContext,
    user: AuthContext,
    agentId: string,
    status: AgentStatus,
    requestId: string | null,
  ): Promise<AgentDto> {
    return this.database.db.transaction().execute(async (trx) => {
      const agent = await this.findAgent(
        trx,
        tenant.organizationId,
        agentId,
        true,
      );
      if (!canTransition(agent.status, status)) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          'INVALID_STATUS_TRANSITION',
          'Ce changement de statut n’est pas possible.',
        );
      }
      const current = await this.currentVersion(trx, agent);
      if (status === 'active') {
        this.assertReady(
          agent,
          {
            instructions: current.instructions,
            objectives: current.objectives,
            maxSteps: current.max_steps,
            maxDurationSeconds: current.max_duration_seconds,
            errorPolicy: current.error_policy,
            tools: toVersionDto(current).tools,
          },
          await this.caps(tenant.organizationId, trx),
        );
      }
      const updated = await trx
        .updateTable('app.agents')
        .set({ status })
        .where('id', '=', agent.id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await this.audit.record(trx, {
        organizationId: tenant.organizationId,
        actorType: 'user',
        actorId: user.userId,
        action: 'agent.status_changed',
        targetType: 'agent',
        targetId: agent.id,
        metadata: { from: agent.status, to: status },
        requestId,
      });
      return toAgentDto(updated, current);
    });
  }

  /** Controlled test: deterministic checks and brief, no model call. */
  async test(
    organizationId: string,
    agentId: string,
  ): Promise<AgentTestReportDto> {
    const agent = await this.get(organizationId, agentId);
    const caps = await this.caps(organizationId);
    const configuration = agent.currentVersion;
    const checks = checkAgentConfiguration(agent, configuration, caps);
    return {
      ready: checks.every((check) => check.severity !== 'error'),
      checks,
      brief: buildAgentBrief(agent, configuration, {
        role: AGENT_ROLE_LABELS,
        errorPolicy: ERROR_POLICY_LABELS,
      }),
      testedVersion: configuration.version,
    };
  }
}
