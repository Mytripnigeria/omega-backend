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
import { KpiTargetsService } from './kpi-targets.service';
import {
  CreateKpiTargetDto,
  KpiPerformanceRowDto,
  KpiTargetFilterDto,
  KpiTargetResponseDto,
  RecordKpiPerformanceDto,
  UpdateKpiTargetDto,
} from './dto/kpi-target.dto';

interface AuthedRequest extends Request {
  user?: JwtPayload;
}

function actorFrom(req: AuthedRequest): {
  sub: string;
  sub_type: 'admin' | 'staff';
  businessId: string;
  storeId?: string;
  roleId?: string;
} {
  const user = req.user!;
  if (user.sub_type === 'staff') {
    return {
      sub: user.sub,
      sub_type: 'staff',
      businessId: user.businessId,
      storeId: user.storeId,
      roleId: user.roleId,
    };
  }
  return {
    sub: user.sub,
    sub_type: 'admin',
    businessId: user.businessId,
  };
}

@ApiTags('kpi-targets')
@ApiBearerAuth()
@UseGuards(JwtOrStaffGuard)
@Controller('kpi-targets')
export class KpiTargetsController {
  constructor(private readonly service: KpiTargetsService) {}

  @ApiOperation({ summary: 'List KPI targets' })
  @ApiOkResponse({ description: 'Paginated KpiTargetResponseDto list' })
  @Get()
  list(@Req() req: AuthedRequest, @Query() filter: KpiTargetFilterDto) {
    return this.service.list(actorFrom(req), filter);
  }

  @ApiOperation({ summary: 'Get a single KPI target' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: KpiTargetResponseDto })
  @Get(':id')
  findOne(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.findOne(actorFrom(req), id);
  }

  @ApiOperation({
    summary: 'Per-staff performance breakdown',
    description:
      'Returns one row per staff member who can contribute to the target, with their value, share, progress, and source ("computed" for sales/orders categories; "manual" otherwise).',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: [KpiPerformanceRowDto] })
  @Get(':id/performances')
  listPerformances(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.listPerformances(actorFrom(req), id);
  }

  @ApiOperation({ summary: 'Create a KPI target (admin)' })
  @ApiCreatedResponse({ type: KpiTargetResponseDto })
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreateKpiTargetDto) {
    return this.service.create(actorFrom(req), dto);
  }

  @ApiOperation({ summary: 'Update a KPI target (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: KpiTargetResponseDto })
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateKpiTargetDto,
  ) {
    return this.service.update(actorFrom(req), id, dto);
  }

  @ApiOperation({
    summary: 'Record manual per-staff performance (admin)',
    description:
      'Upserts a per-staff progress value for KPI categories that aren\'t auto-computed from orders.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: [KpiPerformanceRowDto] })
  @UseGuards(JwtAuthGuard)
  @Post(':id/performances')
  recordPerformance(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: RecordKpiPerformanceDto,
  ) {
    return this.service.recordPerformance(actorFrom(req), id, dto);
  }

  @ApiOperation({ summary: 'Soft-delete a KPI target (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.remove(actorFrom(req), id);
  }
}
