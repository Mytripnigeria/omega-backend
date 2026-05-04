import { ExecutionContext, ForbiddenException, createParamDecorator } from '@nestjs/common';
import { AdminJwtPayload } from '../types/jwt-payload.types';

interface AuthedRequest {
  user?: AdminJwtPayload;
}

/**
 * Pulls the admin's businessId from the JWT payload.
 * Throws 403 if the request is unauthenticated or the token is not an admin token
 * (the JwtAuthGuard normally handles auth, but this protects against guard misuse).
 */
export const BusinessId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const user = req.user;
    if (!user || user.sub_type !== 'admin' || !user.businessId) {
      throw new ForbiddenException('Business context unavailable');
    }
    return user.businessId;
  },
);
