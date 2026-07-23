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
import { DeliveryRegionsService } from './delivery-regions.service';
import {
  CreateDeliveryRegionDto,
  DeliveryRegionFilterDto,
  DeliveryRegionResponseDto,
  UpdateDeliveryRegionDto,
} from './dto/delivery-region.dto';

// Guards are per-method: reads accept an admin JWT (merchant hub settings) or a
// staff JWT (POS needs the region list to price a delivery order); writes stay
// admin-only.
@ApiTags('delivery-regions')
@ApiBearerAuth()
@Controller('delivery-regions')
export class DeliveryRegionsController {
  constructor(private readonly service: DeliveryRegionsService) {}

  @ApiOperation({ summary: 'List delivery regions for a store' })
  @ApiOkResponse({ type: [DeliveryRegionResponseDto] })
  @UseGuards(JwtOrStaffGuard)
  @Get()
  list(@Query() filter: DeliveryRegionFilterDto) {
    return this.service.findAll(filter);
  }

  @ApiOperation({ summary: 'Get a single delivery region' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: DeliveryRegionResponseDto })
  @UseGuards(JwtOrStaffGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @ApiOperation({ summary: 'Create a delivery region' })
  @ApiCreatedResponse({ type: DeliveryRegionResponseDto })
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() dto: CreateDeliveryRegionDto) {
    return this.service.create(dto);
  }

  @ApiOperation({ summary: 'Update a delivery region' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: DeliveryRegionResponseDto })
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDeliveryRegionDto) {
    return this.service.update(id, dto);
  }

  @ApiOperation({ summary: 'Delete a delivery region' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
