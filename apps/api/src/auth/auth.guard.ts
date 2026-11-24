import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiException } from '../common/api-exception.js';
import type { AppRequest } from '../common/request-context.js';
import { DatabaseService } from '../database/database.service.js';
import { JWT_VERIFIER, type JwtVerifier } from './jwt-verifier.js';
import { IS_PUBLIC } from './public.decorator.js';

/** Global guard: every route requires a valid Supabase JWT unless @Public. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(JWT_VERIFIER) private readonly verifier: JwtVerifier,
    private readonly database: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AppRequest>();
    const header = request.headers.authorization;
    const match =
      typeof header === 'string' ? /^Bearer (\S+)$/.exec(header) : null;
    if (!match?.[1]) {
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        'UNAUTHENTICATED',
        'Authentification requise.',
      );
    }
    const auth = await this.verifier.verify(match[1]);
    // An account archived by the platform opens nothing (ADR-074).
    const profile = await this.database.db
      .selectFrom('app.user_profiles')
      .select('archived_at')
      .where('id', '=', auth.userId)
      .executeTakeFirst();
    if (profile?.archived_at)
      throw new ApiException(
        HttpStatus.FORBIDDEN,
        'ACCOUNT_ARCHIVED',
        'Ce compte est archivé. Contactez l’équipe Nagaw pour le rouvrir.',
      );
    request.auth = auth;
    return true;
  }
}
