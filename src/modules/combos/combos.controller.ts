import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CombosService } from './combos.service';
import { CreateComboDto, CreateComboItemDto } from './dto/create-combo.dto';
import { UpdateComboDto, ToggleComboStatusDto } from './dto/update-combo.dto';
import { UpdateComboItemDto } from './dto/update-combo-item.dto';
import { FilterComboDto } from './dto/filter-combo.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtOrStaffGuard } from '../../common/guards/jwt-or-staff.guard';
import { BusinessContext } from '../../common/decorators/business-context.decorator';
import { ComboResponseDto } from './dto/combo-response.dto';

@ApiTags('combos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('combos')
export class CombosController {
  constructor(private readonly combosService: CombosService) {}

  @ApiOperation({
    summary: 'Create a combo',
    description: 'Admin-only. Creates a bundled combo meal at a discounted price. `originalPrice` is the sum of individual item prices; `price` is the combo selling price.',
  })
  @ApiCreatedResponse({ type: ComboResponseDto })
  @Post()
  create(@Body() dto: CreateComboDto) {
    return this.combosService.create(dto);
  }

  @ApiOperation({ summary: 'List combos', description: 'Returns paginated combos.' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { $ref: '#/components/schemas/ComboResponseDto' } },
        total: { type: 'integer', example: 10 },
        page: { type: 'integer', example: 1 },
        limit: { type: 'integer', example: 20 },
        totalPages: { type: 'integer', example: 1 },
      },
    },
  })
  // Staff-readable: the workstation POS lists combos alongside products.
  @UseGuards(JwtOrStaffGuard)
  @Get()
  findAll(
    @BusinessContext() businessId: string,
    @Query() query: FilterComboDto,
  ) {
    return this.combosService.findAll(businessId, query);
  }

  @ApiOperation({ summary: 'Combo statistics' })
  @ApiQuery({ name: 'storeId', required: false, format: 'uuid' })
  @ApiOkResponse({ schema: { example: { total: 10, active: 9, inactive: 1, totalSales: 342 } } })
  @Get('stats')
  getStats(@Query('storeId') storeId?: string) {
    return this.combosService.getStats(storeId);
  }

  @ApiOperation({ summary: 'Get a single combo' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ComboResponseDto })
  @UseGuards(JwtOrStaffGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.combosService.findOne(id);
  }

  @ApiOperation({ summary: 'Update a combo', description: 'Admin-only. Partial update.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ComboResponseDto })
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateComboDto) {
    return this.combosService.update(id, dto);
  }

  @ApiOperation({ summary: 'Soft-delete a combo', description: 'Admin-only.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.combosService.remove(id);
  }

  @ApiOperation({ summary: 'Toggle combo availability', description: 'Admin-only. Toggles the `isActive` flag.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ComboResponseDto })
  @Patch(':id/status')
  toggleStatus(@Param('id') id: string, @Body() dto: ToggleComboStatusDto) {
    return this.combosService.toggleStatus(id, dto);
  }

  @ApiOperation({ summary: 'Add a product to the combo', description: 'Admin-only.' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Combo ID' })
  @ApiCreatedResponse({ description: 'Item added to combo.' })
  @Post(':id/items')
  addItem(@Param('id') id: string, @Body() dto: CreateComboItemDto) {
    return this.combosService.addItem(id, dto);
  }

  @ApiOperation({ summary: 'Update a combo item', description: 'Admin-only. Typically used to change quantity.' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Combo ID' })
  @ApiParam({ name: 'itemId', format: 'uuid', description: 'Combo Item ID' })
  @ApiOkResponse({ description: 'Item updated.' })
  @Patch(':id/items/:itemId')
  updateItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateComboItemDto,
  ) {
    return this.combosService.updateItem(id, itemId, dto);
  }

  @ApiOperation({ summary: 'Remove a product from the combo', description: 'Admin-only.' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Combo ID' })
  @ApiParam({ name: 'itemId', format: 'uuid', description: 'Combo Item ID' })
  @ApiNoContentResponse()
  @Delete(':id/items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.combosService.removeItem(id, itemId);
  }
}
