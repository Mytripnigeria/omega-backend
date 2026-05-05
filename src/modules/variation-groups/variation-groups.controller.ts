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
import { VariationGroupsService } from './variation-groups.service';
import { CreateVariationGroupDto } from './dto/create-variation-group.dto';
import { UpdateVariationGroupDto } from './dto/update-variation-group.dto';
import { FilterVariationGroupDto } from './dto/filter-variation-group.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessId } from '../../common/decorators/business-id.decorator';
import { VariationGroupResponseDto } from './dto/variation-group-response.dto';

@ApiTags('variation-groups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('variation-groups')
export class VariationGroupsController {
  constructor(private readonly service: VariationGroupsService) {}

  @ApiOperation({
    summary: 'Create a variation group',
    description: 'Admin-only. Creates a group (e.g. "Size") with its options (e.g. Small, Medium, Large).',
  })
  @ApiCreatedResponse({ type: VariationGroupResponseDto })
  @Post()
  create(@BusinessId() businessId: string, @Body() dto: CreateVariationGroupDto) {
    return this.service.create(businessId, dto);
  }

  @ApiOperation({ summary: 'List variation groups' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { $ref: '#/components/schemas/VariationGroupResponseDto' } },
        total: { type: 'integer', example: 8 },
        page: { type: 'integer', example: 1 },
        limit: { type: 'integer', example: 20 },
        totalPages: { type: 'integer', example: 1 },
      },
    },
  })
  @Get()
  findAll(@BusinessId() businessId: string, @Query() query: FilterVariationGroupDto) {
    return this.service.findAll(businessId, query);
  }

  @ApiOperation({ summary: 'Variation group statistics' })
  @ApiOkResponse({ schema: { example: { total: 8, active: 7, inactive: 1 } } })
  @Get('stats')
  getStats(@BusinessId() businessId: string) {
    return this.service.getStats(businessId);
  }

  @ApiOperation({ summary: 'Get a single variation group' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: VariationGroupResponseDto })
  @Get(':id')
  findOne(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.findOne(businessId, id);
  }

  @ApiOperation({ summary: 'Update a variation group', description: 'Admin-only. Partial update.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: VariationGroupResponseDto })
  @Patch(':id')
  update(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateVariationGroupDto,
  ) {
    return this.service.update(businessId, id, dto);
  }

  @ApiOperation({ summary: 'Soft-delete a variation group', description: 'Admin-only.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.remove(businessId, id);
  }
}
