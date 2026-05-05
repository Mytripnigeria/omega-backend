import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtOrStaffGuard } from '../../common/guards/jwt-or-staff.guard';
import { JwtPayload } from '../../common/types/jwt-payload.types';
import { ExpensesService } from './expenses.service';
import {
  CreateExpenseDto,
  ExpenseFilterDto,
  MarkPaidExpenseDto,
  ReviewExpenseDto,
  UpdateExpenseDto,
} from './dto/expense-dto';
import { ExpenseResponseDto } from './dto/expense-response.dto';

interface AuthedRequest extends Request {
  user?: JwtPayload;
}

function actorFrom(req: AuthedRequest): {
  sub: string;
  sub_type: 'admin' | 'staff';
  businessId: string;
  storeId?: string;
  actorName?: string;
} {
  const user = req.user!;
  if (user.sub_type === 'staff') {
    return {
      sub: user.sub,
      sub_type: 'staff',
      businessId: user.businessId,
      storeId: user.storeId,
      actorName: user.staffCode,
    };
  }
  return {
    sub: user.sub,
    sub_type: 'admin',
    businessId: user.businessId,
    actorName: user.email,
  };
}

@ApiTags('expenses')
@ApiBearerAuth()
@UseGuards(JwtOrStaffGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly service: ExpensesService) {}

  @ApiOperation({
    summary: 'Submit an expense request',
    description: 'Staff-only. Creates a pending expense request for admin review.',
  })
  @ApiCreatedResponse({ type: ExpenseResponseDto })
  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreateExpenseDto) {
    return this.service.create(actorFrom(req), dto);
  }

  @ApiOperation({
    summary: 'List expenses',
    description:
      'Returns paginated expenses scoped to the caller\'s business. Staff are auto-scoped to their store. ' +
      'Filter by status (`pending,approved,rejected,paid`), category, requester, or date range.',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { $ref: '#/components/schemas/ExpenseResponseDto' } },
        total: { type: 'integer', example: 42 },
        page: { type: 'integer', example: 1 },
        limit: { type: 'integer', example: 20 },
        totalPages: { type: 'integer', example: 3 },
      },
    },
  })
  @Get()
  findAll(@Req() req: AuthedRequest, @Query() filter: ExpenseFilterDto) {
    return this.service.findAll(actorFrom(req), filter);
  }

  @ApiOperation({
    summary: 'My expenses',
    description: 'Staff-only. Returns expenses submitted by the authenticated staff member.',
  })
  @ApiOkResponse({ description: 'Paginated ExpenseResponseDto list' })
  @Get('my')
  findMy(@Req() req: AuthedRequest, @Query() filter: ExpenseFilterDto) {
    return this.service.findMy(actorFrom(req), filter);
  }

  @ApiOperation({ summary: 'Get a single expense' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ExpenseResponseDto })
  @Get(':id')
  findOne(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.findOne(actorFrom(req), id);
  }

  @ApiOperation({
    summary: 'Update an expense',
    description: 'Submitter-only. Allowed only while status=pending.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ExpenseResponseDto })
  @Patch(':id')
  update(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.service.update(actorFrom(req), id, dto);
  }

  @ApiOperation({
    summary: 'Approve expense',
    description: 'Admin-only. Transitions pending → approved.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ExpenseResponseDto })
  @Post(':id/approve')
  approve(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: ReviewExpenseDto,
  ) {
    return this.service.approve(actorFrom(req), id, dto);
  }

  @ApiOperation({
    summary: 'Reject expense',
    description: 'Admin-only. Transitions pending → rejected with reason.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ExpenseResponseDto })
  @Post(':id/reject')
  reject(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: ReviewExpenseDto,
  ) {
    return this.service.reject(actorFrom(req), id, dto);
  }

  @ApiOperation({
    summary: 'Mark expense as paid',
    description: 'Admin-only. Transitions approved → paid and records payment time/method.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ExpenseResponseDto })
  @Post(':id/mark-paid')
  markPaid(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: MarkPaidExpenseDto,
  ) {
    return this.service.markPaid(actorFrom(req), id, dto);
  }

  @ApiOperation({
    summary: 'Delete a pending expense',
    description: 'Submitter-only. Soft-deletes a pending expense.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.remove(actorFrom(req), id);
  }
}
