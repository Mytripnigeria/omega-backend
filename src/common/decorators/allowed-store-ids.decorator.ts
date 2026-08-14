import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { JwtPayload } from '../types/jwt-payload.types';

interface AuthedRequest {
  user?: JwtPayload;
}

/**
 * The stores the caller may work in, or `null` for "every store in the
 * business".
 *
 * A merchant-dashboard login granted to a staff member can be restricted to
 * the store(s) they actually work at; the business owner is unrestricted. A
 * workstation (staff) token is always bound to its single store.
 */
export const AllowedStoreIds = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string[] | null => {
    const user = ctx.switchToHttp().getRequest<AuthedRequest>().user;
    if (!user) return null;

    if ('storeIds' in user) {
      const ids = (user as { storeIds?: string[] | null }).storeIds;
      if (Array.isArray(ids) && ids.length > 0) return ids;
      return null;
    }
    // Staff tokens carry exactly one store.
    if ('storeId' in user) {
      const id = (user as { storeId?: string }).storeId;
      return id ? [id] : null;
    }
    return null;
  },
);
