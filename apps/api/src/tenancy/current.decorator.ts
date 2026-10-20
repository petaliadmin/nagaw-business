import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type {
  AppRequest,
  AuthContext,
  TenantContext,
} from '../common/request-context.js';

function requestOf(context: ExecutionContext): AppRequest {
  return context.switchToHttp().getRequest<AppRequest>();
}

/** Authenticated caller. Only valid on non-@Public routes. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthContext => {
    const { auth } = requestOf(context);
    if (!auth) throw new Error('CurrentUser used on an unauthenticated route');
    return auth;
  },
);

/** Verified tenant. Only valid on routes using @RequirePermission. */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, context: ExecutionContext): TenantContext => {
    const { tenant } = requestOf(context);
    if (!tenant)
      throw new Error('CurrentTenant used without @RequirePermission');
    return tenant;
  },
);

/** Request id assigned by the logger, for audit correlation. */
export const RequestId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | null => {
    const { id } = requestOf(context);
    return id === undefined ? null : String(id);
  },
);
