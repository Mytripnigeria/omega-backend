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
import { InventoryLocationsService } from './inventory-locations.service';
import { CreateInventoryLocationDto } from './dto/create-inventory-location.dto';
import { UpdateInventoryLocationDto } from './dto/update-inventory-location.dto';
import { InventoryLocationFilterDto } from './dto/inventory-location-filter.dto';
import { InventoryLocationResponseDto } from './dto/inventory-location-response.dto';

@ApiTags('inventory-locations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inventory-locations')
export class InventoryLocationsController {
  constructor(private readonly service: InventoryLocationsService) {}

  @ApiOperation({ summary: 'List inventory locations' })
  @Get()
  list(@Query() filter: InventoryLocationFilterDto) {
    return this.service.findAll(filter);
  }

  @ApiOperation({ summary: 'Get a single inventory location' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: InventoryLocationResponseDto })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @ApiOperation({ summary: 'Create an inventory location' })
  @ApiCreatedResponse({ type: InventoryLocationResponseDto })
  @Post()
  create(@Body() dto: CreateInventoryLocationDto) {
    return this.service.create(dto);
  }

  @ApiOperation({ summary: 'Update an inventory location' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: InventoryLocationResponseDto })
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateInventoryLocationDto) {
    return this.service.update(id, dto);
  }

  @ApiOperation({ summary: 'Delete an inventory location' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
