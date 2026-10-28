import { HttpStatus, Injectable } from '@nestjs/common';
import {
  memberChangeRefusal,
  type MemberChangeRefusal,
  type MemberDto,
  type UpdateMemberInput,
} from '@nagaw/shared';
import { AuditService } from '../audit/audit.service.js';
import { ApiException } from '../common/api-exception.js';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { DatabaseService } from '../database/database.service.js';
import { pgErrorCode } from '../database/pg-errors.js';
import { assertMemberRoom } from './member-limit.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CHECK_VIOLATION = '23514';

const REFUSAL_MESSAGES: Record<MemberChangeRefusal, string> = {
  SELF_CHANGE_FORBIDDEN:
    'Vous ne pouvez pas modifier votre propre rôle ni votre propre accès.',
  OWNER_PROTECTED: 'Seul un propriétaire peut modifier un propriétaire.',
  OWNER_PROMOTION_FORBIDDEN:
    'Seul un propriétaire peut nommer un autre propriétaire.',
};

function memberNotFound(): ApiException {
  return new ApiException(
    HttpStatus.NOT_FOUND,
    'MEMBER_NOT_FOUND',
    'Membre introuvable.',
  );
}

@Injectable()
export class MembersService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Changes a member's role and/or status within the caller's organization.
   * The target is always looked up inside that organization, so another
   * tenant's member is simply "not found".
   */
  async update(
    tenant: TenantContext,
    actor: AuthContext,
    targetUserId: string,
    input: UpdateMemberInput,
    requestId: string | null,
  ): Promise<MemberDto> {
    if (!UUID_RE.test(targetUserId)) throw memberNotFound();

    try {
      return await this.database.db.transaction().execute(async (trx) => {
        const target = await trx
          .selectFrom('app.organization_memberships as m')
          .innerJoin('app.user_profiles as p', 'p.id', 'm.user_id')
          .select([
            'm.id',
            'm.user_id',
            'm.role',
            'm.status',
            'm.max_discount_basis_points',
            'm.created_at',
            'p.email',
            'p.display_name',
          ])
          .where('m.organization_id', '=', tenant.organizationId)
          .where('m.user_id', '=', targetUserId)
          .forUpdate('m')
          .executeTakeFirst();
        if (!target) throw memberNotFound();

        const refusal = memberChangeRefusal(
          { userId: actor.userId, role: tenant.role },
          { userId: target.user_id, role: target.role },
          input,
        );
        if (refusal) {
          throw new ApiException(
            HttpStatus.FORBIDDEN,
            refusal,
            REFUSAL_MESSAGES[refusal],
          );
        }

        const role = input.role ?? target.role;
        const status = input.status ?? target.status;
        const maxDiscount =
          input.maxDiscountBasisPoints === undefined
            ? target.max_discount_basis_points
            : input.maxDiscountBasisPoints;
        if (target.status === 'disabled' && status === 'active')
          await assertMemberRoom(trx, tenant.organizationId, false);
        if (
          role !== target.role ||
          status !== target.status ||
          maxDiscount !== target.max_discount_basis_points
        ) {
          await trx
            .updateTable('app.organization_memberships')
            .set({ role, status, max_discount_basis_points: maxDiscount })
            .where('id', '=', target.id)
            .execute();

          const base = {
            organizationId: tenant.organizationId,
            actorType: 'user' as const,
            actorId: actor.userId,
            targetType: 'user',
            targetId: target.user_id,
            requestId,
          };
          if (role !== target.role) {
            await this.audit.record(trx, {
              ...base,
              action: 'member.role_changed',
              metadata: { email: target.email, from: target.role, to: role },
            });
          }
          if (maxDiscount !== target.max_discount_basis_points) {
            await this.audit.record(trx, {
              ...base,
              action: 'member.discount_limit_changed',
              metadata: {
                email: target.email,
                from: target.max_discount_basis_points,
                to: maxDiscount,
              },
            });
          }
          if (status !== target.status) {
            await this.audit.record(trx, {
              ...base,
              action:
                status === 'disabled'
                  ? 'member.disabled'
                  : 'member.reactivated',
              metadata: { email: target.email },
            });
          }
        }

        return {
          userId: target.user_id,
          email: target.email,
          displayName: target.display_name,
          role,
          status,
          maxDiscountBasisPoints: maxDiscount,
          joinedAt: target.created_at.toISOString(),
        };
      });
    } catch (error) {
      // Database backstop: the organization would be left without owner.
      if (
        pgErrorCode(error) === CHECK_VIOLATION &&
        (error as { constraint?: string }).constraint ===
          'organization_has_active_owner'
      ) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          'LAST_OWNER',
          'L’organisation doit garder au moins un propriétaire actif.',
        );
      }
      throw error;
    }
  }
}
