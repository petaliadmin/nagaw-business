import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ApiException } from '../common/api-exception.js';
import type { AppRequest } from '../common/request-context.js';
import { DatabaseService } from '../database/database.service.js';

/**
 * Lets through platform administrators only (ADR-030), checked in the
 * database on every request; being a shop owner gives nothing here.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly database: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AppRequest>();
    if (!request.auth) {
      // AuthGuard runs first; reaching here without auth is a wiring bug.
      throw new Error('PlatformAdminGuard requires an authenticated request');
    }
    const admin = await this.database.db
      .selectFrom('app.platform_admins')
      .select('user_id')
      .where('user_id', '=', request.auth.userId)
      .executeTakeFirst();
    if (!admin)
      throw new ApiException(
        HttpStatus.FORBIDDEN,
        'PLATFORM_ADMIN_REQUIRED',
        'Réservé à l’administration de la plateforme.',
      );
    return true;
  }
}
