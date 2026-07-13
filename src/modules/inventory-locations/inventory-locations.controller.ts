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
import { JwtOrStaffGuard } from '../../common/guards/jwt-or-staff.guard';
import { InventoryLocationsService } from './inventory-locations.service';
import { CreateInventoryLocationDto } from './dto/create-inventory-location.dto';
import { UpdateInventoryLocationDto } from './dto/update-inventory-location.dto';
import { InventoryLocationFilterDto } from './dto/inventory-location-filter.dto';
import { InventoryLocationResponseDto } from './dto/inventory-location-response.dto';

// Guards are per-method: the read endpoints accept BOTH an admin JWT (merchant
// hub) and a staff JWT (workstation Instore/Outstore), while create/update/
// delete stay admin-only. Previously the class-level admin guard 401'd staff
// reads, which the workstation turns into a forced logout.
@ApiTags('inventory-locations')
@ApiBearerAuth()
@Controller('inventory-locations')
export class InventoryLocationsController {
  constructor(private readonly service: InventoryLocationsService) {}

  @ApiOperation({ summary: 'List inventory locations' })
  @UseGuards(JwtOrStaffGuard)
  @Get()
  list(@Query() filter: InventoryLocationFilterDto) {
    return this.service.findAll(filter);
  }

  @ApiOperation({ summary: 'Get a single inventory location' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: InventoryLocationResponseDto })
  @UseGuards(JwtOrStaffGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @ApiOperation({ summary: 'Create an inventory location' })
  @ApiCreatedResponse({ type: InventoryLocationResponseDto })
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() dto: CreateInventoryLocationDto) {
    return this.service.create(dto);
  }

  @ApiOperation({ summary: 'Update an inventory location' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: InventoryLocationResponseDto })
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateInventoryLocationDto) {
    return this.service.update(id, dto);
  }

  @ApiOperation({ summary: 'Delete an inventory location' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
