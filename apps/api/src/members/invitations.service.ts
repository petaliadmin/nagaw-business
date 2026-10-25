import { HttpStatus, Injectable } from '@nestjs/common';
import type {
  CreateInvitationInput,
  CreatedInvitationDto,
  InvitationDto,
  InvitationPreviewDto,
  InvitationStatus,
  OrganizationWithRoleDto,
} from '@nagaw/shared';
import { sql, type Transaction } from 'kysely';
import { AuditService } from '../audit/audit.service.js';
import { ApiException } from '../common/api-exception.js';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { DatabaseService } from '../database/database.service.js';
import { pgErrorCode, UNIQUE_VIOLATION } from '../database/pg-errors.js';
import type { Database } from '../database/schema.js';
import { OrganizationsService } from '../organizations/organizations.service.js';
import {
  generateInvitationToken,
  hashInvitationToken,
} from './invitation-token.js';
import { assertMemberRoom } from './member-limit.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface InvitationRow {
  id: string;
  email: string;
  role: 'admin' | 'member' | 'viewer';
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expires_at: Date;
  created_at: Date;
  invited_by: string;
  inviter_email: string;
}

function effectiveStatus(
  row: { status: InvitationStatus; expires_at: Date },
  now = new Date(),
): InvitationStatus {
  return row.status === 'pending' && row.expires_at <= now
    ? 'expired'
    : row.status;
}

function toDto(row: InvitationRow): InvitationDto {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    status: effectiveStatus(row),
    expiresAt: row.expires_at.toISOString(),
    createdAt: row.created_at.toISOString(),
    invitedBy: { userId: row.invited_by, email: row.inviter_email },
  };
}

function invitationNotFound(): ApiException {
  return new ApiException(
    HttpStatus.NOT_FOUND,
    'INVITATION_NOT_FOUND',
    'Invitation introuvable.',
  );
}

/** Why a token can no longer be used, as an API error. */
function unusable(status: InvitationStatus): ApiException {
  switch (status) {
    case 'accepted':
      return new ApiException(
        HttpStatus.CONFLICT,
        'INVITATION_ALREADY_USED',
        'Cette invitation a déjà été acceptée.',
      );
    case 'revoked':
      return new ApiException(
        HttpStatus.GONE,
        'INVITATION_REVOKED',
        'Cette invitation a été annulée.',
      );
    default:
      return new ApiException(
        HttpStatus.GONE,
        'INVITATION_EXPIRED',
        'Cette invitation a expiré. Demandez-en une nouvelle.',
      );
  }
}

@Injectable()
export class InvitationsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
    private readonly organizations: OrganizationsService,
  ) {}

  private selectInvitations(executor: Transaction<Database> | undefined) {
    return (executor ?? this.database.db)
      .selectFrom('app.organization_invitations as i')
      .innerJoin('app.user_profiles as p', 'p.id', 'i.invited_by')
      .select([
        'i.id',
        'i.email',
        'i.role',
        'i.status',
        'i.expires_at',
        'i.created_at',
        'i.invited_by',
        'p.email as inviter_email',
      ]);
  }

  /** Pending invitations, expired ones included until they are replaced. */
  async listPending(organizationId: string): Promise<InvitationDto[]> {
    const rows = await this.selectInvitations(undefined)
      .where('i.organization_id', '=', organizationId)
      .where('i.status', '=', 'pending')
      .orderBy('i.created_at', 'desc')
      .execute();
    return rows.map(toDto);
  }

  async create(
    tenant: TenantContext,
    actor: AuthContext,
    input: CreateInvitationInput,
    requestId: string | null,
  ): Promise<CreatedInvitationDto> {
    const token = generateInvitationToken();
    try {
      return await this.database.db.transaction().execute(async (trx) => {
        // Serializes invitations of one organization (limit check below).
        const organization = await trx
          .selectFrom('app.organizations')
          .select(['invitation_ttl_hours', 'max_pending_invitations'])
          .where('id', '=', tenant.organizationId)
          .forUpdate()
          .executeTakeFirstOrThrow();

        const existingMember = await trx
          .selectFrom('app.organization_memberships as m')
          .innerJoin('app.user_profiles as p', 'p.id', 'm.user_id')
          .select('m.status')
          .where('m.organization_id', '=', tenant.organizationId)
          .where(sql<string>`lower(p.email)`, '=', input.email)
          .executeTakeFirst();
        if (existingMember) {
          throw new ApiException(
            HttpStatus.CONFLICT,
            'ALREADY_MEMBER',
            existingMember.status === 'active'
              ? 'Cette personne est déjà membre de l’organisation.'
              : 'Cette personne est membre mais désactivée : réactivez-la depuis la liste des membres.',
          );
        }

        // Expired invitations stop blocking a new one for the same address.
        await trx
          .updateTable('app.organization_invitations')
          .set({ status: 'expired' })
          .where('organization_id', '=', tenant.organizationId)
          .where('status', '=', 'pending')
          .where('expires_at', '<=', sql<Date>`now()`)
          .execute();

        const { pending } = await trx
          .selectFrom('app.organization_invitations')
          .select((eb) => eb.fn.countAll<string>().as('pending'))
          .where('organization_id', '=', tenant.organizationId)
          .where('status', '=', 'pending')
          .executeTakeFirstOrThrow();
        if (Number(pending) >= organization.max_pending_invitations) {
          throw new ApiException(
            HttpStatus.CONFLICT,
            'INVITATION_LIMIT_REACHED',
            `Limite de ${organization.max_pending_invitations} invitations en attente atteinte. Annulez-en avant d’en créer de nouvelles.`,
          );
        }

        // Each pending invitation promises a place of the offer.
        await assertMemberRoom(trx, tenant.organizationId, true);

        const inserted = await trx
          .insertInto('app.organization_invitations')
          .values({
            organization_id: tenant.organizationId,
            email: input.email,
            role: input.role,
            token_hash: hashInvitationToken(token),
            invited_by: actor.userId,
            expires_at: sql<Date>`now() + make_interval(hours => ${organization.invitation_ttl_hours})`,
          })
          .returning('id')
          .executeTakeFirstOrThrow();

        await this.audit.record(trx, {
          organizationId: tenant.organizationId,
          actorType: 'user',
          actorId: actor.userId,
          action: 'invitation.created',
          targetType: 'invitation',
          targetId: inserted.id,
          metadata: { email: input.email, role: input.role },
          requestId,
        });

        const row = await this.selectInvitations(trx)
          .where('i.id', '=', inserted.id)
          .executeTakeFirstOrThrow();
        return { invitation: toDto(row), token };
      });
    } catch (error) {
      if (pgErrorCode(error) === UNIQUE_VIOLATION) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          'INVITATION_PENDING',
          'Une invitation est déjà en attente pour cette adresse.',
        );
      }
      throw error;
    }
  }

  async revoke(
    tenant: TenantContext,
    actor: AuthContext,
    invitationId: string,
    requestId: string | null,
  ): Promise<InvitationDto> {
    if (!UUID_RE.test(invitationId)) throw invitationNotFound();
    return this.database.db.transaction().execute(async (trx) => {
      const current = await trx
        .selectFrom('app.organization_invitations')
        .select(['status', 'expires_at', 'email'])
        .where('id', '=', invitationId)
        .where('organization_id', '=', tenant.organizationId)
        .forUpdate()
        .executeTakeFirst();
      if (!current) throw invitationNotFound();
      if (current.status !== 'pending') {
        throw new ApiException(
          HttpStatus.CONFLICT,
          'INVITATION_NOT_PENDING',
          'Cette invitation n’est plus en attente.',
        );
      }

      await trx
        .updateTable('app.organization_invitations')
        .set({
          status: 'revoked',
          revoked_by: actor.userId,
          revoked_at: sql<Date>`now()`,
        })
        .where('id', '=', invitationId)
        .execute();

      await this.audit.record(trx, {
        organizationId: tenant.organizationId,
        actorType: 'user',
        actorId: actor.userId,
        action: 'invitation.revoked',
        targetType: 'invitation',
        targetId: invitationId,
        metadata: { email: current.email },
        requestId,
      });

      return toDto(
        await this.selectInvitations(trx)
          .where('i.id', '=', invitationId)
          .executeTakeFirstOrThrow(),
      );
    });
  }

  /** What the invitee sees before accepting. */
  async preview(
    user: AuthContext,
    token: string,
  ): Promise<InvitationPreviewDto> {
    const row = await this.database.db
      .selectFrom('app.organization_invitations as i')
      .innerJoin('app.organizations as o', 'o.id', 'i.organization_id')
      .select([
        'i.email',
        'i.role',
        'i.status',
        'i.expires_at',
        'o.name as organization_name',
        'o.status as organization_status',
      ])
      .where('i.token_hash', '=', hashInvitationToken(token))
      .executeTakeFirst();
    if (!row || row.organization_status !== 'active') {
      throw invitationNotFound();
    }
    const email = await this.profileEmail(user.userId);
    return {
      organizationName: row.organization_name,
      email: row.email,
      role: row.role,
      status: effectiveStatus(row),
      expiresAt: row.expires_at.toISOString(),
      emailMatches: email === row.email,
    };
  }

  /** Joins the organization, if the token is live and meant for this user. */
  async accept(
    user: AuthContext,
    token: string,
    requestId: string | null,
  ): Promise<OrganizationWithRoleDto> {
    const organizationId = await this.database.db
      .transaction()
      .execute(async (trx) => {
        const invitation = await trx
          .selectFrom('app.organization_invitations as i')
          .innerJoin('app.organizations as o', 'o.id', 'i.organization_id')
          .select([
            'i.id',
            'i.organization_id',
            'i.email',
            'i.role',
            'i.status',
            'i.expires_at',
            'o.status as organization_status',
          ])
          .where('i.token_hash', '=', hashInvitationToken(token))
          .forUpdate('i')
          .executeTakeFirst();
        if (!invitation || invitation.organization_status !== 'active') {
          throw invitationNotFound();
        }
        const status = effectiveStatus(invitation);
        if (status !== 'pending') throw unusable(status);

        const email = await this.profileEmail(user.userId, trx);
        if (email !== invitation.email) {
          throw new ApiException(
            HttpStatus.FORBIDDEN,
            'INVITATION_EMAIL_MISMATCH',
            'Cette invitation est destinée à une autre adresse e-mail.',
          );
        }

        const membership = await trx
          .selectFrom('app.organization_memberships')
          .select('status')
          .where('organization_id', '=', invitation.organization_id)
          .where('user_id', '=', user.userId)
          .executeTakeFirst();
        if (membership) {
          throw new ApiException(
            HttpStatus.CONFLICT,
            'ALREADY_MEMBER',
            membership.status === 'active'
              ? 'Vous êtes déjà membre de cette organisation.'
              : 'Votre accès à cette organisation a été désactivé. Contactez un administrateur.',
          );
        }

        await assertMemberRoom(trx, invitation.organization_id, false);
        await trx
          .insertInto('app.organization_memberships')
          .values({
            organization_id: invitation.organization_id,
            user_id: user.userId,
            role: invitation.role,
          })
          .execute();
        await trx
          .updateTable('app.organization_invitations')
          .set({
            status: 'accepted',
            accepted_by: user.userId,
            accepted_at: sql<Date>`now()`,
          })
          .where('id', '=', invitation.id)
          .execute();
        await this.audit.record(trx, {
          organizationId: invitation.organization_id,
          actorType: 'user',
          actorId: user.userId,
          action: 'invitation.accepted',
          targetType: 'invitation',
          targetId: invitation.id,
          metadata: { email: invitation.email, role: invitation.role },
          requestId,
        });
        return invitation.organization_id;
      });

    const joined = (await this.organizations.listForUser(user.userId)).find(
      (organization) => organization.id === organizationId,
    );
    if (!joined) throw new Error('Accepted invitation without membership');
    return joined;
  }

  /** The address of record: the profile, kept in sync with Supabase Auth. */
  private async profileEmail(
    userId: string,
    executor?: Transaction<Database>,
  ): Promise<string> {
    const profile = await (executor ?? this.database.db)
      .selectFrom('app.user_profiles')
      .select('email')
      .where('id', '=', userId)
      .executeTakeFirst();
    if (!profile) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'PROFILE_MISSING',
        'Profil utilisateur introuvable.',
      );
    }
    return profile.email.toLowerCase();
  }
}
