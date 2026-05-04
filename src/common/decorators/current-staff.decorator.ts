import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { StaffJwtPayload } from '../types/jwt-payload.types';

export const CurrentStaff = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): StaffJwtPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as StaffJwtPayload;
  },
);
