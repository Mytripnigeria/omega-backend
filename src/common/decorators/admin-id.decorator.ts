import { ExecutionContext, ForbiddenException, createParamDecorator } from '@nestjs/common';
import { AdminJwtPayload } from '../types/jwt-payload.types';

interface AuthedRequest {
  user?: AdminJwtPayload;
}

export const AdminId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const user = req.user;
    if (!user || user.sub_type !== 'admin' || !user.sub) {
      throw new ForbiddenException('Admin context unavailable');
    }
    return user.sub;
  },
);
