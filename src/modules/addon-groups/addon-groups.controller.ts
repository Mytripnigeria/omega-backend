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
} from '@nestjs/swagger';
import { AddOnGroupsService } from './addon-groups.service';
import { CreateAddOnGroupDto, CreateAddOnDto } from './dto/create-addon-group.dto';
import { UpdateAddOnGroupDto, UpdateAddOnDto } from './dto/update-addon-group.dto';
import { FilterAddOnGroupDto } from './dto/filter-addon-group.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessId } from '../../common/decorators/business-id.decorator';
import {
  AddOnGroupResponseDto,
  AddOnResponseDto,
} from './dto/addon-group-response.dto';

@ApiTags('addon-groups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('addon-groups')
export class AddOnGroupsController {
  constructor(private readonly service: AddOnGroupsService) {}

  @ApiOperation({
    summary: 'Create an addon group',
    description: 'Admin-only. Creates a group (e.g. "Proteins") with its individual addon items.',
  })
  @ApiCreatedResponse({ type: AddOnGroupResponseDto })
  @Post()
  create(@BusinessId() businessId: string, @Body() dto: CreateAddOnGroupDto) {
    return this.service.create(businessId, dto);
  }

  @ApiOperation({ summary: 'List addon groups' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { $ref: '#/components/schemas/AddOnGroupResponseDto' } },
        total: { type: 'integer', example: 6 },
        page: { type: 'integer', example: 1 },
        limit: { type: 'integer', example: 20 },
        totalPages: { type: 'integer', example: 1 },
      },
    },
  })
  @Get()
  findAll(@BusinessId() businessId: string, @Query() query: FilterAddOnGroupDto) {
    return this.service.findAll(businessId, query);
  }

  @ApiOperation({ summary: 'Addon group statistics' })
  @ApiOkResponse({ schema: { example: { total: 6, active: 5, inactive: 1 } } })
  @Get('stats')
  getStats(
    @BusinessId() businessId: string,
    @Query('storeId') storeId?: string,
  ) {
    return this.service.getStats(businessId, storeId);
  }

  @ApiOperation({ summary: 'Get a single addon group' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AddOnGroupResponseDto })
  @Get(':id')
  findOne(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.findOne(businessId, id);
  }

  @ApiOperation({ summary: 'Update an addon group', description: 'Admin-only. Partial update.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AddOnGroupResponseDto })
  @Patch(':id')
  update(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAddOnGroupDto,
  ) {
    return this.service.update(businessId, id, dto);
  }

  @ApiOperation({ summary: 'Soft-delete an addon group', description: 'Admin-only.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.remove(businessId, id);
  }

  @ApiOperation({ summary: 'Add an addon item', description: 'Admin-only. Adds a single addon to the group.' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Addon Group ID' })
  @ApiCreatedResponse({ type: AddOnResponseDto })
  @Post(':id/addons')
  addAddon(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() dto: CreateAddOnDto,
  ) {
    return this.service.addAddon(businessId, id, dto);
  }

  @ApiOperation({ summary: 'Update an addon item', description: 'Admin-only.' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Addon Group ID' })
  @ApiParam({ name: 'addonId', format: 'uuid', description: 'Addon ID' })
  @ApiOkResponse({ type: AddOnResponseDto })
  @Patch(':id/addons/:addonId')
  updateAddon(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Param('addonId') addonId: string,
    @Body() dto: UpdateAddOnDto,
  ) {
    return this.service.updateAddon(businessId, id, addonId, dto);
  }

  @ApiOperation({ summary: 'Remove an addon item', description: 'Admin-only.' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Addon Group ID' })
  @ApiParam({ name: 'addonId', format: 'uuid', description: 'Addon ID' })
  @ApiNoContentResponse()
  @Delete(':id/addons/:addonId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeAddon(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Param('addonId') addonId: string,
  ) {
    return this.service.removeAddon(businessId, id, addonId);
  }

  @ApiOperation({
    summary: 'Toggle addon availability',
    description: 'Admin-only. Toggles the `isAvailable` flag on a single addon item (e.g. temporarily out of stock).',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Addon Group ID' })
  @ApiParam({ name: 'addonId', format: 'uuid', description: 'Addon ID' })
  @ApiOkResponse({ type: AddOnResponseDto })
  @Patch(':id/addons/:addonId/availability')
  toggleAvailability(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Param('addonId') addonId: string,
  ) {
    return this.service.toggleAvailability(businessId, id, addonId);
  }
}
