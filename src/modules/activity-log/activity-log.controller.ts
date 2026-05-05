import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtOrStaffGuard } from '../../common/guards/jwt-or-staff.guard';
import { BusinessContext } from '../../common/decorators/business-context.decorator';
import { JwtPayload } from '../../common/types/jwt-payload.types';
import { ActivityLogService } from './activity-log.service';
import { ActivityLogFilterDto } from './dto/activity-log-filter.dto';
import { ActivityLogResponseDto } from './dto/activity-log-response.dto';

interface AuthedRequest extends Request {
  user?: JwtPayload;
}

@ApiTags('activity-log')
@ApiBearerAuth()
@UseGuards(JwtOrStaffGuard)
@Controller('activity-log')
export class ActivityLogController {
  constructor(private readonly service: ActivityLogService) {}

  @ApiOperation({
    summary: 'List activity log entries',
    description:
      'Returns paginated audit-trail entries scoped to the caller\'s business. ' +
      'Admin tokens see all entries in the business. Staff tokens see only entries ' +
      'in their store, plus their own actions across stores. Use `action=order.*` to ' +
      'match a namespace, or pass an exact action key.',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { $ref: '#/components/schemas/ActivityLogResponseDto' } },
        total: { type: 'integer', example: 142 },
        page: { type: 'integer', example: 1 },
        limit: { type: 'integer', example: 20 },
        totalPages: { type: 'integer', example: 8 },
      },
    },
  })
  @Get()
  list(
    @BusinessContext() businessId: string,
    @Query() filter: ActivityLogFilterDto,
    @Req() req: AuthedRequest,
  ) {
    const user = req.user;
    // Staff can only see entries in their own store, or their own actions.
    const scope =
      user && user.sub_type === 'staff'
        ? { storeId: user.storeId, actorId: user.sub }
        : undefined;
    return this.service.findAll(businessId, filter, scope);
  }
}

// Re-export so Swagger picks up the schema name.
export { ActivityLogResponseDto };
