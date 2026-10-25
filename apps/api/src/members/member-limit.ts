import { HttpStatus } from '@nestjs/common';
import type { Transaction } from 'kysely';
import { ApiException } from '../common/api-exception.js';
import type { Database } from '../database/schema.js';

/**
 * Refuses one more person in the shop beyond its offer (`max_members`,
 * ADR-029). The organization row stays locked, so that two invitations
 * accepted at once cannot both pass. Pending invitations count as places
 * already promised when `countInvitations` is set.
 */
export async function assertMemberRoom(
  trx: Transaction<Database>,
  organizationId: string,
  countInvitations: boolean,
): Promise<void> {
  const { max_members } = await trx
    .selectFrom('app.organizations')
    .select('max_members')
    .where('id', '=', organizationId)
    .forUpdate()
    .executeTakeFirstOrThrow();
  const { active } = await trx
    .selectFrom('app.organization_memberships')
    .select((eb) => eb.fn.countAll<string>().as('active'))
    .where('organization_id', '=', organizationId)
    .where('status', '=', 'active')
    .executeTakeFirstOrThrow();
  let taken = Number(active);
  if (countInvitations) {
    const { pending } = await trx
      .selectFrom('app.organization_invitations')
      .select((eb) => eb.fn.countAll<string>().as('pending'))
      .where('organization_id', '=', organizationId)
      .where('status', '=', 'pending')
      .executeTakeFirstOrThrow();
    taken += Number(pending);
  }
  if (taken >= max_members)
    throw new ApiException(
      HttpStatus.CONFLICT,
      'MEMBER_LIMIT_REACHED',
      `L’offre de la boutique permet ${max_members} personne${max_members > 1 ? 's' : ''}${
        countInvitations ? ', invitations en attente comprises' : ''
      }. Changez d’offre dans « Abonnement » pour en ajouter.`,
    );
}
