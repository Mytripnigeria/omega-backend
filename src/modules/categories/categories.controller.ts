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
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { FilterCategoryDto } from './dto/filter-category.dto';
import { ReorderCategoriesDto } from './dto/reorder-category.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtOrStaffGuard } from '../../common/guards/jwt-or-staff.guard';
import { BusinessId } from '../../common/decorators/business-id.decorator';
import { BusinessContext } from '../../common/decorators/business-context.decorator';
import { CategoryType } from './entities/category.entity';
import { CategoryResponseDto } from './dto/category-response.dto';

@ApiTags('categories')
@ApiBearerAuth()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @ApiOperation({
    summary: 'Create a category',
    description:
      'Admin-only. Creates a category for the authenticated business. ' +
      'If `type` is omitted it defaults to "menu". Names must be unique per (business, type).',
  })
  @ApiCreatedResponse({ type: CategoryResponseDto })
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@BusinessId() businessId: string, @Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(businessId, dto);
  }

  @ApiOperation({
    summary: 'List categories',
    description:
      'Returns paginated categories for the caller\'s business. Accepts both admin and staff JWTs. ' +
      'Use `type` to scope to a single domain (menu, inventory, expense, equipment).',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { $ref: '#/components/schemas/CategoryResponseDto' } },
        total: { type: 'integer', example: 24 },
        page: { type: 'integer', example: 1 },
        limit: { type: 'integer', example: 100 },
        totalPages: { type: 'integer', example: 1 },
      },
    },
  })
  @UseGuards(JwtOrStaffGuard)
  @Get()
  findAll(@BusinessContext() businessId: string, @Query() query: FilterCategoryDto) {
    return this.categoriesService.findAll(businessId, query);
  }

  @ApiOperation({
    summary: 'Category counts',
    description:
      'Returns total/active/inactive counts plus a per-type breakdown. Pass `type` to scope to one domain.',
  })
  @ApiQuery({ name: 'type', enum: CategoryType, required: false })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        total: { type: 'integer', example: 24 },
        active: { type: 'integer', example: 22 },
        inactive: { type: 'integer', example: 2 },
        byType: {
          type: 'object',
          properties: {
            menu: { type: 'integer', example: 6 },
            inventory: { type: 'integer', example: 6 },
            expense: { type: 'integer', example: 5 },
            equipment: { type: 'integer', example: 4 },
          },
        },
      },
    },
  })
  @UseGuards(JwtOrStaffGuard)
  @Get('stats')
  getStats(
    @BusinessContext() businessId: string,
    @Query('type') type?: CategoryType,
    @Query('storeId') storeId?: string,
  ) {
    return this.categoriesService.getStats(businessId, type, storeId);
  }

  @ApiOperation({
    summary: 'Reorder categories',
    description:
      'Admin-only. Bulk-updates the `order` field for the supplied list of categories. ' +
      'All ids must belong to the caller\'s business.',
  })
  @ApiNoContentResponse()
  @UseGuards(JwtAuthGuard)
  @Patch('reorder')
  @HttpCode(HttpStatus.NO_CONTENT)
  reorder(@BusinessId() businessId: string, @Body() dto: ReorderCategoriesDto) {
    return this.categoriesService.reorder(businessId, dto);
  }

  @ApiOperation({ summary: 'Get a single category' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: CategoryResponseDto })
  @UseGuards(JwtOrStaffGuard)
  @Get(':id')
  findOne(@BusinessContext() businessId: string, @Param('id') id: string) {
    return this.categoriesService.findOne(businessId, id);
  }

  @ApiOperation({ summary: 'Update a category', description: 'Admin-only. Partial update.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: CategoryResponseDto })
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(businessId, id, dto);
  }

  @ApiOperation({ summary: 'Soft-delete a category', description: 'Admin-only.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.categoriesService.remove(businessId, id);
  }
}
