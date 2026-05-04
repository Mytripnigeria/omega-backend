import { ExecutionContext, ForbiddenException, createParamDecorator } from '@nestjs/common';
import { JwtPayload } from '../types/jwt-payload.types';

interface AuthedRequest {
  user?: JwtPayload;
}

/**
 * Returns businessId from either an admin or staff JWT payload.
 * Use on endpoints that should accept either token type (e.g. read-only resources
 * shared across the merchant hub and the workstation app).
 */
export const BusinessContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const user = ctx.switchToHttp().getRequest<AuthedRequest>().user;
    if (!user || !('businessId' in user) || !user.businessId) {
      throw new ForbiddenException('Business context unavailable');
    }
    return user.businessId;
  },
);
