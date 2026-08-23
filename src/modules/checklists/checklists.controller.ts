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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtOrStaffGuard } from '../../common/guards/jwt-or-staff.guard';
import { JwtPayload } from '../../common/types/jwt-payload.types';
import { ChecklistsService } from './checklists.service';
import {
  ChecklistFilterDto,
  ChecklistPerformanceQueryDto,
  ChecklistResponseDto,
  CreateChecklistDto,
  ToggleChecklistItemDto,
  UpdateChecklistDto,
} from './dto/checklist.dto';

interface AuthedRequest extends Request {
  user?: JwtPayload;
}

function actorFrom(req: AuthedRequest): {
  sub: string;
  sub_type: 'admin' | 'staff';
  businessId: string;
  storeId?: string;
  roleId?: string;
  actorName?: string;
} {
  const user = req.user!;
  if (user.sub_type === 'staff') {
    return {
      sub: user.sub,
      sub_type: 'staff',
      businessId: user.businessId,
      storeId: user.storeId,
      roleId: user.roleId,
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

// Reads + item toggles accept either JWT (staff can mark items done during
// service). Create / edit / delete are admin-only.
@ApiTags('checklists')
@ApiBearerAuth()
@UseGuards(JwtOrStaffGuard)
@Controller('checklists')
export class ChecklistsController {
  constructor(private readonly service: ChecklistsService) {}

  @ApiOperation({ summary: 'List checklists' })
  @ApiOkResponse({ description: 'Paginated ChecklistResponseDto list' })
  @Get()
  list(@Req() req: AuthedRequest, @Query() filter: ChecklistFilterDto) {
    return this.service.list(actorFrom(req), filter);
  }

  @ApiOperation({ summary: 'Get a single checklist' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ChecklistResponseDto })
  @Get(':id')
  findOne(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.findOne(actorFrom(req), id);
  }

  @ApiOperation({
    summary: 'Per-assignee performance for a checklist',
    description:
      'How each assigned staff member has filled this checklist in the current ' +
      'recurrence period — powers the per-assignee modal in the merchant hub.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @Get(':id/performances')
  performances(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Query() query: ChecklistPerformanceQueryDto,
  ) {
    return this.service.getPerformances(actorFrom(req), id, query.date);
  }

  @ApiOperation({ summary: 'Create a checklist (admin)' })
  @ApiCreatedResponse({ type: ChecklistResponseDto })
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreateChecklistDto) {
    return this.service.create(actorFrom(req), dto);
  }

  @ApiOperation({ summary: 'Update a checklist (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ChecklistResponseDto })
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateChecklistDto,
  ) {
    return this.service.update(actorFrom(req), id, dto);
  }

  @ApiOperation({
    summary: 'Toggle a checklist item completed/uncompleted',
    description:
      'Staff or admin. The item id must belong to this checklist; the operation is idempotent.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'itemId' })
  @ApiOkResponse({ type: ChecklistResponseDto })
  @Patch(':id/items/:itemId')
  toggleItem(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: ToggleChecklistItemDto,
  ) {
    return this.service.toggleItem(actorFrom(req), id, itemId, dto);
  }

  @ApiOperation({ summary: 'Soft-delete a checklist (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.remove(actorFrom(req), id);
  }
}
