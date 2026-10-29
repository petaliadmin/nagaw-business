import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { roleHasPermission, type Permission } from '@nagaw/shared';
import { ApiException } from '../common/api-exception.js';
import type { AppRequest } from '../common/request-context.js';
import { DatabaseService } from '../database/database.service.js';
import { REQUIRED_PERMISSION } from './require-permission.decorator.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves the active organization from `X-Organization-Id` and checks, in
 * the database, that the authenticated user is an active member (or the
 * platform administrator with an open access, ADR-040) holding the route's
 * permission. The header is never trusted on its own (ADR-005).
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly database: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<Permission | undefined>(
      REQUIRED_PERMISSION,
      [context.getHandler(), context.getClass()],
    );
    if (!permission) return true;

    const request = context.switchToHttp().getRequest<AppRequest>();
    if (!request.auth) {
      // AuthGuard runs first; reaching here without auth is a wiring bug.
      throw new Error('TenantGuard requires an authenticated request');
    }

    const organizationId = request.headers['x-organization-id'];
    if (typeof organizationId !== 'string' || !UUID_RE.test(organizationId)) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'ORGANIZATION_HEADER_INVALID',
        'En-tête X-Organization-Id manquant ou invalide.',
      );
    }

    const membership =
      (await this.database.db
        .selectFrom('app.organization_memberships as m')
        .innerJoin('app.organizations as o', 'o.id', 'm.organization_id')
        .select(['m.role'])
        .where('m.organization_id', '=', organizationId)
        .where('m.user_id', '=', request.auth.userId)
        .where('m.status', '=', 'active')
        .where('o.status', '=', 'active')
        .executeTakeFirst()) ??
      (await this.platformAccess(organizationId, request.auth.userId));

    // Same answer whether the organization does not exist or the caller is
    // not a member: never reveal another tenant's existence.
    if (!membership) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        'ORGANIZATION_NOT_FOUND',
        'Organisation introuvable.',
      );
    }
    if (!roleHasPermission(membership.role, permission)) {
      throw new ApiException(
        HttpStatus.FORBIDDEN,
        'PERMISSION_DENIED',
        'Votre rôle ne permet pas cette action.',
      );
    }

    request.tenant = { organizationId, role: membership.role };
    return true;
  }

  /**
   * The platform administrator inside a shop through an open access
   * (ADR-040): the rights of an owner, while they stay administrator.
   */
  private async platformAccess(organizationId: string, userId: string) {
    const access = await this.database.db
      .selectFrom('app.platform_shop_accesses as a')
      .innerJoin('app.platform_admins as p', 'p.user_id', 'a.admin_id')
      .innerJoin('app.organizations as o', 'o.id', 'a.organization_id')
      .select('a.id')
      .where('a.organization_id', '=', organizationId)
      .where('a.admin_id', '=', userId)
      .where('a.closed_at', 'is', null)
      .where('o.status', '=', 'active')
      .executeTakeFirst();
    return access ? { role: 'owner' as const } : undefined;
  }
}
