import { HttpStatus, Injectable } from '@nestjs/common';
import type {
  CreateOrganizationInput,
  MemberDto,
  OrganizationDto,
  OrganizationWithRoleDto,
  Role,
  UpdateOrganizationInput,
} from '@nagaw/shared';
import type { Selectable } from 'kysely';
import { AuditService } from '../audit/audit.service.js';
import { ApiException } from '../common/api-exception.js';
import type { AuthContext } from '../common/request-context.js';
import { DatabaseService } from '../database/database.service.js';
import {
  FOREIGN_KEY_VIOLATION,
  pgErrorCode,
  UNIQUE_VIOLATION,
} from '../database/pg-errors.js';
import type { OrganizationsTable } from '../database/schema.js';
import { generateSlug } from './slug.js';

const MAX_SLUG_ATTEMPTS = 3;

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  /** Creates an organization; the creator becomes its owner. */
  async create(
    user: AuthContext,
    input: CreateOrganizationInput,
    requestId: string | null,
  ): Promise<OrganizationWithRoleDto> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.database.db.transaction().execute(async (trx) => {
          const organization = await trx
            .insertInto('app.organizations')
            .values({
              name: input.name,
              slug: generateSlug(input.name),
              timezone: input.timezone,
              default_currency: input.defaultCurrency,
              created_by: user.userId,
            })
            .returningAll()
            .executeTakeFirstOrThrow();

          await trx
            .insertInto('app.organization_memberships')
            .values({
              organization_id: organization.id,
              user_id: user.userId,
              role: 'owner',
            })
            .execute();

          await this.audit.record(trx, {
            organizationId: organization.id,
            actorType: 'user',
            actorId: user.userId,
            action: 'organization.created',
            targetType: 'organization',
            targetId: organization.id,
            metadata: { name: organization.name },
            requestId,
          });

          return { ...toOrganizationDto(organization), role: 'owner' as Role };
        });
      } catch (error) {
        const code = pgErrorCode(error);
        if (code === UNIQUE_VIOLATION && attempt < MAX_SLUG_ATTEMPTS) continue;
        if (code === FOREIGN_KEY_VIOLATION) {
          // The auth trigger did not create a profile for this user.
          throw new ApiException(
            HttpStatus.CONFLICT,
            'PROFILE_MISSING',
            'Profil utilisateur introuvable.',
          );
        }
        throw error;
      }
    }
  }

  async get(organizationId: string): Promise<OrganizationDto> {
    const organization = await this.database.db
      .selectFrom('app.organizations')
      .selectAll()
      .where('id', '=', organizationId)
      .executeTakeFirstOrThrow();
    return toOrganizationDto(organization);
  }

  async update(
    organizationId: string,
    user: AuthContext,
    input: UpdateOrganizationInput,
    requestId: string | null,
  ): Promise<OrganizationDto> {
    return this.database.db.transaction().execute(async (trx) => {
      const before = await trx
        .selectFrom('app.organizations')
        .selectAll()
        .where('id', '=', organizationId)
        .forUpdate()
        .executeTakeFirstOrThrow();

      const updated = await trx
        .updateTable('app.organizations')
        .set({
          ...(input.name !== undefined && { name: input.name }),
          ...(input.timezone !== undefined && { timezone: input.timezone }),
          ...(input.defaultCurrency !== undefined && {
            default_currency: input.defaultCurrency,
          }),
          ...(input.invitationTtlHours !== undefined && {
            invitation_ttl_hours: input.invitationTtlHours,
          }),
        })
        .where('id', '=', organizationId)
        .returningAll()
        .executeTakeFirstOrThrow();

      const changes: Record<string, { from: unknown; to: unknown }> = {};
      if (before.name !== updated.name) {
        changes.name = { from: before.name, to: updated.name };
      }
      if (before.timezone !== updated.timezone) {
        changes.timezone = { from: before.timezone, to: updated.timezone };
      }
      if (before.default_currency !== updated.default_currency) {
        changes.defaultCurrency = {
          from: before.default_currency,
          to: updated.default_currency,
        };
      }
      if (before.invitation_ttl_hours !== updated.invitation_ttl_hours) {
        changes.invitationTtlHours = {
          from: before.invitation_ttl_hours,
          to: updated.invitation_ttl_hours,
        };
      }

      await this.audit.record(trx, {
        organizationId,
        actorType: 'user',
        actorId: user.userId,
        action: 'organization.updated',
        targetType: 'organization',
        targetId: organizationId,
        metadata: { changes },
        requestId,
      });

      return toOrganizationDto(updated);
    });
  }

  async listMembers(organizationId: string): Promise<MemberDto[]> {
    const rows = await this.database.db
      .selectFrom('app.organization_memberships as m')
      .innerJoin('app.user_profiles as p', 'p.id', 'm.user_id')
      .select([
        'm.user_id',
        'p.email',
        'p.display_name',
        'm.role',
        'm.status',
        'm.created_at',
      ])
      .where('m.organization_id', '=', organizationId)
      .orderBy('m.created_at', 'asc')
      .execute();
    return rows.map((row) => ({
      userId: row.user_id,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
      status: row.status,
      joinedAt: row.created_at.toISOString(),
    }));
  }

  /** Active organizations the user belongs to, with their role. */
  async listForUser(userId: string): Promise<OrganizationWithRoleDto[]> {
    const rows = await this.database.db
      .selectFrom('app.organization_memberships as m')
      .innerJoin('app.organizations as o', 'o.id', 'm.organization_id')
      .selectAll('o')
      .select('m.role')
      .where('m.user_id', '=', userId)
      .where('m.status', '=', 'active')
      .where('o.status', '=', 'active')
      .orderBy('o.name', 'asc')
      .execute();
    return rows.map((row) => ({ ...toOrganizationDto(row), role: row.role }));
  }
}

function toOrganizationDto(
  row: Selectable<OrganizationsTable>,
): OrganizationDto {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    timezone: row.timezone,
    defaultCurrency: row.default_currency,
    invitationTtlHours: row.invitation_ttl_hours,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
