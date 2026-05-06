import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtOrStaffGuard } from '../../common/guards/jwt-or-staff.guard';
import { JwtPayload } from '../../common/types/jwt-payload.types';
import { CashSessionsService } from './cash-sessions.service';
import {
  CashSessionFilterDto,
  CloseCashSessionDto,
  OpenCashSessionDto,
  ReviewCashSessionDto,
} from './dto/cash-session-dto';
import {
  CashSessionResponseDto,
  CashSessionStatsDto,
} from './dto/cash-session-response.dto';

interface AuthedRequest extends Request {
  user?: JwtPayload;
}

function actorFrom(req: AuthedRequest) {
  const user = req.user!;
  if (user.sub_type === 'staff') {
    return {
      sub: user.sub,
      sub_type: 'staff' as const,
      businessId: user.businessId,
      storeId: user.storeId,
      actorName: user.staffCode,
    };
  }
  return {
    sub: user.sub,
    sub_type: 'admin' as const,
    businessId: user.businessId,
    actorName: user.email,
  };
}

@ApiTags('cash-sessions')
@ApiBearerAuth()
@UseGuards(JwtOrStaffGuard)
@Controller('cash-sessions')
export class CashSessionsController {
  constructor(private readonly service: CashSessionsService) {}

  @ApiOperation({
    summary: 'Open a cash session (staff)',
    description:
      'Staff opens a register session with an opening float. Only one open session per staff/store at a time.',
  })
  @ApiOkResponse({ type: CashSessionResponseDto })
  @Post('open')
  open(@Req() req: AuthedRequest, @Body() dto: OpenCashSessionDto) {
    return this.service.open(actorFrom(req), dto);
  }

  @ApiOperation({
    summary: 'Get my active session (staff)',
    description: 'Returns the staff member\'s currently-open cash session, or null.',
  })
  @ApiOkResponse({ type: CashSessionResponseDto })
  @Get('me/active')
  myActive(@Req() req: AuthedRequest) {
    return this.service.myActive(actorFrom(req));
  }

  @ApiOperation({
    summary: 'List cash sessions',
    description:
      'Paginated list of cash sessions. Staff are auto-scoped to their store.',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/CashSessionResponseDto' },
        },
        total: { type: 'integer' },
        page: { type: 'integer' },
        limit: { type: 'integer' },
        totalPages: { type: 'integer' },
      },
    },
  })
  @Get()
  list(@Req() req: AuthedRequest, @Query() filter: CashSessionFilterDto) {
    return this.service.findAll(actorFrom(req), filter);
  }

  @ApiOperation({ summary: 'Cash session stats' })
  @ApiOkResponse({ type: CashSessionStatsDto })
  @Get('stats')
  stats(@Req() req: AuthedRequest, @Query() filter: CashSessionFilterDto) {
    return this.service.getStats(actorFrom(req), filter);
  }

  @ApiOperation({ summary: 'Get a single cash session' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: CashSessionResponseDto })
  @Get(':id')
  findOne(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.findOne(actorFrom(req), id);
  }

  @ApiOperation({
    summary: 'Close a cash session',
    description:
      'Staff submits actual cash/card/mobile counts. Backend computes expected from order ' +
      'payments inside the session window and the resulting reconciliation status.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: CashSessionResponseDto })
  @Post(':id/close')
  close(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: CloseCashSessionDto,
  ) {
    return this.service.close(actorFrom(req), id, dto);
  }

  @ApiOperation({
    summary: 'Review a closed session (admin)',
    description: 'Admin marks the session reviewed and adds an optional note.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: CashSessionResponseDto })
  @Post(':id/review')
  review(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: ReviewCashSessionDto,
  ) {
    return this.service.review(actorFrom(req), id, dto);
  }
}
