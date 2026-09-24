import {
  BadRequestException,
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
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessId } from '../../common/decorators/business-id.decorator';
import { AdminJwtPayload } from '../../common/types/jwt-payload.types';
import { WorkstationSettingsService } from './workstation-settings.service';
import { UpdateWorkstationSettingsDto } from './dto/update-workstation-settings.dto';
import { WorkstationSettingsResponseDto } from './dto/workstation-settings-response.dto';
import { UpsertGeofenceDto } from './dto/workstation-geofence.dto';

@ApiTags('workstation-settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workstation-settings')
export class WorkstationSettingsController {
  constructor(private readonly service: WorkstationSettingsService) {}

  @ApiOperation({
    summary: 'Get a store’s workstation settings',
    description:
      'Settings belong to a store, not the business — branches keep their own ' +
      'PIN rules, clock-in window, auto-accept and geofence. On first call, ' +
      'lazily creates a row of defaults for that store.',
  })
  @ApiQuery({ name: 'storeId', format: 'uuid' })
  @ApiOkResponse({ type: WorkstationSettingsResponseDto })
  @Get()
  get(@BusinessId() businessId: string, @Query('storeId') storeId: string) {
    if (!storeId) throw new BadRequestException('storeId is required');
    return this.service.get(businessId, storeId);
  }

  @ApiOperation({
    summary: 'Places this store’s staff may work from',
    description:
      'A store can have several — a dining room and a kitchen unit down the ' +
      'road — and staff inside ANY of them pass the geofence check.',
  })
  @ApiQuery({ name: 'storeId', format: 'uuid' })
  @Get('geofences')
  listGeofences(
    @BusinessId() businessId: string,
    @Query('storeId') storeId: string,
  ) {
    if (!storeId) throw new BadRequestException('storeId is required');
    return this.service.listGeofences(businessId, storeId);
  }

  @ApiOperation({ summary: 'Add a place staff may work from' })
  @ApiQuery({ name: 'storeId', format: 'uuid' })
  @Post('geofences')
  addGeofence(
    @BusinessId() businessId: string,
    @Query('storeId') storeId: string,
    @Req() req: Request,
    @Body() dto: UpsertGeofenceDto,
  ) {
    if (!storeId) throw new BadRequestException('storeId is required');
    return this.service.addGeofence(
      businessId,
      storeId,
      req.user as AdminJwtPayload,
      dto,
    );
  }

  @ApiOperation({ summary: 'Update one place' })
  @ApiQuery({ name: 'storeId', format: 'uuid' })
  @Patch('geofences/:id')
  updateGeofence(
    @BusinessId() businessId: string,
    @Query('storeId') storeId: string,
    @Param('id') id: string,
    @Body() dto: UpsertGeofenceDto,
  ) {
    if (!storeId) throw new BadRequestException('storeId is required');
    return this.service.updateGeofence(businessId, storeId, id, dto);
  }

  @ApiOperation({ summary: 'Remove a place' })
  @ApiQuery({ name: 'storeId', format: 'uuid' })
  @Delete('geofences/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeGeofence(
    @BusinessId() businessId: string,
    @Query('storeId') storeId: string,
    @Param('id') id: string,
  ) {
    if (!storeId) throw new BadRequestException('storeId is required');
    return this.service.removeGeofence(businessId, storeId, id);
  }

  @ApiOperation({
    summary: 'Update workstation settings',
    description:
      'Admin-only. Partially updates the workstation policy settings (PIN, screen timeout, ' +
      'shift, notification, access-control, printing, and advanced policy fields).',
  })
  @ApiOkResponse({ type: WorkstationSettingsResponseDto })
  @ApiQuery({ name: 'storeId', format: 'uuid' })
  @Patch()
  update(
    @BusinessId() businessId: string,
    @Query('storeId') storeId: string,
    @Req() req: Request,
    @Body() dto: UpdateWorkstationSettingsDto,
  ) {
    if (!storeId) throw new BadRequestException('storeId is required');
    return this.service.update(
      businessId,
      storeId,
      req.user as AdminJwtPayload,
      dto,
    );
  }
}
