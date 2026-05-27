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
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtOrStaffGuard } from '../../common/guards/jwt-or-staff.guard';
import { JwtPayload } from '../../common/types/jwt-payload.types';
import { EquipmentService } from './equipment.service';
import {
  CreateEquipmentDto,
  CreateMaintenanceLogDto,
  EquipmentFilterDto,
  UpdateEquipmentDto,
} from './dto/equipment.dto';
import {
  EquipmentResponseDto,
  MaintenanceLogResponseDto,
} from './dto/equipment-response.dto';
import {
  CreateTemperatureReadingDto,
  EquipmentTemperatureStatusDto,
  TemperatureReadingResponseDto,
} from './dto/temperature-reading.dto';

interface AuthedRequest extends Request {
  user?: JwtPayload;
}

function actorFrom(req: AuthedRequest): { sub: string; actorName?: string | null } | null {
  const u = req.user;
  if (!u) return null;
  const actorName =
    u.sub_type === 'staff' ? u.staffCode : 'email' in u ? (u.email as string) : null;
  return { sub: u.sub, actorName };
}

// Reads + temperature logging accept both admin and staff JWTs. Write
// operations on the equipment master (create/update/delete/maintenance log)
// add `JwtAuthGuard` per-method so only admins can perform them.
@ApiTags('equipment')
@ApiBearerAuth()
@UseGuards(JwtOrStaffGuard)
@Controller('equipment')
export class EquipmentController {
  constructor(private readonly service: EquipmentService) {}

  @ApiOperation({ summary: 'List equipment' })
  @Get()
  list(@Query() filter: EquipmentFilterDto) {
    return this.service.findAll(filter);
  }

  @ApiOperation({
    summary: 'Temperature status across all monitored equipment',
    description:
      'Returns one row per equipment item that has temperature monitoring configured, ' +
      'with its latest reading and an `state` flag (ok / out_of_range / stale / unmeasured). ' +
      'Powers the workstation Inventory Alerts Temperature Monitor card.',
  })
  @ApiQuery({ name: 'storeId', required: false, format: 'uuid' })
  @ApiOkResponse({ type: [EquipmentTemperatureStatusDto] })
  @Get('temperature/status')
  temperatureStatus(@Query('storeId') storeId?: string) {
    return this.service.getTemperatureStatus(storeId);
  }

  @ApiOperation({ summary: 'Get one equipment item' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: EquipmentResponseDto })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @ApiOperation({ summary: 'Create equipment (admin)' })
  @ApiCreatedResponse({ type: EquipmentResponseDto })
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() dto: CreateEquipmentDto) {
    return this.service.create(dto);
  }

  @ApiOperation({ summary: 'Update equipment (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: EquipmentResponseDto })
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEquipmentDto) {
    return this.service.update(id, dto);
  }

  @ApiOperation({ summary: 'Delete equipment (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @ApiOperation({ summary: 'Maintenance logs for an equipment item' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: [MaintenanceLogResponseDto] })
  @Get(':id/maintenance')
  listMaintenance(@Param('id') id: string) {
    return this.service.listMaintenance(id);
  }

  @ApiOperation({ summary: 'Log maintenance for an equipment item (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: MaintenanceLogResponseDto })
  @UseGuards(JwtAuthGuard)
  @Post(':id/maintenance')
  logMaintenance(
    @Param('id') id: string,
    @Body() dto: CreateMaintenanceLogDto,
  ) {
    return this.service.logMaintenance(id, dto);
  }

  @ApiOperation({
    summary: 'Log a temperature reading',
    description:
      'Staff or admin. Records a temperature reading against the equipment item; ' +
      "computes `isInRange` against the equipment's configured min/max range and " +
      'updates the equipment\'s denormalized current temperature + last-reading timestamp.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: TemperatureReadingResponseDto })
  @Post(':id/temperature-readings')
  logTemperatureReading(
    @Param('id') id: string,
    @Body() dto: CreateTemperatureReadingDto,
    @Req() req: AuthedRequest,
  ) {
    return this.service.logTemperatureReading(id, dto, actorFrom(req));
  }

  @ApiOperation({ summary: 'Temperature readings history for one equipment item' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiQuery({ name: 'days', required: false, example: 7 })
  @ApiOkResponse({ type: [TemperatureReadingResponseDto] })
  @Get(':id/temperature-readings')
  listTemperatureReadings(
    @Param('id') id: string,
    @Query('days') days?: string,
  ) {
    const parsed = days ? Number.parseInt(days, 10) : 7;
    const window = Number.isFinite(parsed)
      ? Math.min(90, Math.max(1, parsed))
      : 7;
    return this.service.listReadings(id, window);
  }
}
