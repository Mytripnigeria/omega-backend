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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
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

@ApiTags('equipment')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('equipment')
export class EquipmentController {
  constructor(private readonly service: EquipmentService) {}

  @ApiOperation({ summary: 'List equipment' })
  @Get()
  list(@Query() filter: EquipmentFilterDto) {
    return this.service.findAll(filter);
  }

  @ApiOperation({ summary: 'Get one equipment item' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: EquipmentResponseDto })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @ApiOperation({ summary: 'Create equipment' })
  @ApiCreatedResponse({ type: EquipmentResponseDto })
  @Post()
  create(@Body() dto: CreateEquipmentDto) {
    return this.service.create(dto);
  }

  @ApiOperation({ summary: 'Update equipment' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: EquipmentResponseDto })
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEquipmentDto) {
    return this.service.update(id, dto);
  }

  @ApiOperation({ summary: 'Delete equipment' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
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

  @ApiOperation({ summary: 'Log maintenance for an equipment item' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: MaintenanceLogResponseDto })
  @Post(':id/maintenance')
  logMaintenance(
    @Param('id') id: string,
    @Body() dto: CreateMaintenanceLogDto,
  ) {
    return this.service.logMaintenance(id, dto);
  }
}
