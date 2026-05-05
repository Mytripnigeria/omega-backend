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
import { IngredientsService } from './ingredients.service';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { FilterIngredientDto } from './dto/filter-ingredient.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { IngredientResponseDto } from './dto/ingredient-response.dto';

@ApiTags('ingredients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ingredients')
export class IngredientsController {
  constructor(private readonly ingredientsService: IngredientsService) {}

  @ApiOperation({ summary: 'Create an ingredient', description: 'Admin-only.' })
  @ApiCreatedResponse({ type: IngredientResponseDto })
  @Post()
  create(@Body() dto: CreateIngredientDto) {
    return this.ingredientsService.create(dto);
  }

  @ApiOperation({ summary: 'List ingredients', description: 'Returns paginated ingredients with optional filters.' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { $ref: '#/components/schemas/IngredientResponseDto' } },
        total: { type: 'integer', example: 40 },
        page: { type: 'integer', example: 1 },
        limit: { type: 'integer', example: 20 },
        totalPages: { type: 'integer', example: 2 },
      },
    },
  })
  @Get()
  findAll(@Query() query: FilterIngredientDto) {
    return this.ingredientsService.findAll(query);
  }

  @ApiOperation({ summary: 'Ingredient statistics', description: 'Returns counts including low-stock items.' })
  @ApiQuery({ name: 'storeId', required: false, format: 'uuid' })
  @ApiOkResponse({
    schema: {
      example: { total: 40, lowStock: 5, outOfStock: 2 },
    },
  })
  @Get('stats')
  getStats(@Query('storeId') storeId?: string) {
    return this.ingredientsService.getStats(storeId);
  }

  @ApiOperation({ summary: 'Get a single ingredient' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: IngredientResponseDto })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ingredientsService.findOne(id);
  }

  @ApiOperation({ summary: 'Update an ingredient', description: 'Admin-only. Partial update.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: IngredientResponseDto })
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateIngredientDto) {
    return this.ingredientsService.update(id, dto);
  }

  @ApiOperation({ summary: 'Soft-delete an ingredient', description: 'Admin-only.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.ingredientsService.remove(id);
  }

  @ApiOperation({
    summary: 'Adjust ingredient stock',
    description:
      'Admin-only. Adjusts `currentStock` by `delta`. Positive delta = restock; negative = consumption. Returns the updated ingredient.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: IngredientResponseDto })
  @Post(':id/adjust-stock')
  adjustStock(@Param('id') id: string, @Body() dto: AdjustStockDto) {
    return this.ingredientsService.adjustStock(id, dto);
  }
}
