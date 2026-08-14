import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import {
  requiredPermissionFor,
  satisfies,
} from '../permissions/dashboard-permissions';

interface AuthedRequest {
  user?: { sub_type?: string; permissions?: unknown };
  method: string;
  url?: string;
  originalUrl?: string;
}

/**
 * Enforces module permissions on merchant-dashboard logins.
 *
 * Deliberately an **interceptor, not a guard**: a globally-registered guard
 * runs *before* each controller's `JwtAuthGuard`, so `request.user` would still
 * be empty and every check would silently pass. Interceptors run after all
 * guards, so the authenticated principal is available here.
 *
 * Two things this deliberately does not touch:
 *
 *  - **The business owner.** An admin whose `permissions` is null/absent is
 *    unrestricted, exactly as before. Only a login explicitly granted a module
 *    list (a staff member given dashboard access) is restricted, so enabling
 *    this cannot lock an existing merchant out of their own hub.
 *  - **The workstation.** Staff tokens are untouched — their role permissions
 *    are a different vocabulary (`orders.create`, `kitchen.view`) and must not
 *    be measured against the dashboard's. `PermissionsGuard` still handles
 *    those wherever `@RequirePermissions()` is used.
 */
@Injectable()
export class DashboardPermissionsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const user = request.user;

    // Only restricted dashboard logins are checked here.
    if (!user || user.sub_type !== 'admin') return next.handle();
    if (!Array.isArray(user.permissions)) return next.handle();

    const granted = user.permissions.filter(
      (p): p is string => typeof p === 'string',
    );
    const required = requiredPermissionFor(request.method, this.pathOf(request));
    if (required && !satisfies(granted, required)) {
      throw new ForbiddenException(
        `Your dashboard access doesn't include "${required}"`,
      );
    }
    return next.handle();
  }

  /**
   * Request path without the global `api` prefix or query string, so it lines
   * up with the controller prefixes the route map is written in.
   */
  private pathOf(request: AuthedRequest): string {
    const raw = request.originalUrl ?? request.url ?? '';
    return raw.split('?')[0].replace(/^\/+/, '').replace(/^api\//, '');
  }
}
