import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
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
import { Request } from 'express';
import { IngredientsService } from './ingredients.service';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { FilterIngredientDto } from './dto/filter-ingredient.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { MovementFilterDto, TransferStockDto } from './dto/movement-dto';
import { JwtOrStaffGuard } from '../../common/guards/jwt-or-staff.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../../common/types/jwt-payload.types';
import { IngredientResponseDto } from './dto/ingredient-response.dto';
import { IngredientMovementResponseDto } from './dto/movement-response.dto';

interface AuthedRequest extends Request {
  user?: JwtPayload;
}

function actorFrom(req: AuthedRequest): {
  sub: string;
  sub_type: 'admin' | 'staff';
  businessId: string;
  storeId?: string;
  actorName?: string;
} {
  const user = req.user!;
  if (user.sub_type === 'staff') {
    return {
      sub: user.sub,
      sub_type: 'staff',
      businessId: user.businessId,
      storeId: user.storeId,
      actorName: user.staffCode,
    };
  }
  return {
    sub: user.sub,
    sub_type: 'admin',
    businessId: user.businessId,
    actorName: user.email,
  };
}

@ApiTags('ingredients')
@ApiBearerAuth()
@Controller('ingredients')
export class IngredientsController {
  constructor(private readonly ingredientsService: IngredientsService) {}

  @ApiOperation({ summary: 'Create an ingredient', description: 'Admin-only.' })
  @ApiCreatedResponse({ type: IngredientResponseDto })
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() dto: CreateIngredientDto) {
    return this.ingredientsService.create(dto);
  }

  @ApiOperation({
    summary: 'List ingredients',
    description: 'Returns paginated ingredients with optional filters.',
  })
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
  @UseGuards(JwtOrStaffGuard)
  @Get()
  findAll(@Query() query: FilterIngredientDto) {
    return this.ingredientsService.findAll(query);
  }

  @ApiOperation({
    summary: 'Ingredient statistics',
    description: 'Returns counts including low-stock items.',
  })
  @ApiQuery({ name: 'storeId', required: false, format: 'uuid' })
  @ApiOkResponse({ schema: { example: { total: 40, lowStock: 5, totalValue: 1250000, supplierCount: 7 } } })
  @UseGuards(JwtOrStaffGuard)
  @Get('stats')
  getStats(@Query('storeId') storeId?: string) {
    return this.ingredientsService.getStats(storeId);
  }

  @ApiOperation({
    summary: 'List inventory movements',
    description:
      'Append-only movement history across all ingredients. Filter by ingredient, type ' +
      '(intake/consumption/waste/transfer/correction), or date range. Staff are auto-scoped to their store.',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { $ref: '#/components/schemas/IngredientMovementResponseDto' } },
        total: { type: 'integer', example: 120 },
        page: { type: 'integer', example: 1 },
        limit: { type: 'integer', example: 20 },
        totalPages: { type: 'integer', example: 6 },
      },
    },
  })
  @UseGuards(JwtOrStaffGuard)
  @Get('movements')
  listMovements(@Req() req: AuthedRequest, @Query() filter: MovementFilterDto) {
    return this.ingredientsService.listMovements(actorFrom(req), filter);
  }

  @ApiOperation({
    summary: 'List ingredients expiring soon',
    description:
      'Returns ingredients whose best-before / use-by date is within the next N days (default 14). Excludes ingredients without a recorded expiry. Powers the Inventory Alerts "Expiring Soon" card.',
  })
  @ApiQuery({ name: 'storeId', required: false, format: 'uuid' })
  @ApiQuery({ name: 'days', required: false, example: 14, description: 'Look-ahead window in days (1-90).' })
  @ApiOkResponse({ type: [IngredientResponseDto] })
  @UseGuards(JwtOrStaffGuard)
  @Get('expiring')
  findExpiring(
    @Query('storeId') storeId?: string,
    @Query('days') days?: string,
  ) {
    const parsed = days ? Number.parseInt(days, 10) : 14;
    const window = Number.isFinite(parsed)
      ? Math.min(90, Math.max(1, parsed))
      : 14;
    return this.ingredientsService.findExpiring(storeId, window);
  }

  @ApiOperation({ summary: 'Get a single ingredient' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: IngredientResponseDto })
  @UseGuards(JwtOrStaffGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ingredientsService.findOne(id);
  }

  @ApiOperation({
    summary: 'Movement history for an ingredient',
    description: 'Append-only movement entries for one ingredient.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Paginated IngredientMovementResponseDto list' })
  @UseGuards(JwtOrStaffGuard)
  @Get(':id/movements')
  listMovementsForIngredient(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Query() filter: MovementFilterDto,
  ) {
    return this.ingredientsService.listMovementsForIngredient(actorFrom(req), id, filter);
  }

  @ApiOperation({ summary: 'Update an ingredient', description: 'Admin-only. Partial update.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: IngredientResponseDto })
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateIngredientDto) {
    return this.ingredientsService.update(id, dto);
  }

  @ApiOperation({ summary: 'Soft-delete an ingredient', description: 'Admin-only.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.ingredientsService.remove(id);
  }

  @ApiOperation({
    summary: 'Adjust ingredient stock',
    description:
      'Adjusts `currentStock` by `adjustment` (signed). Positive = intake, negative = correction. ' +
      'Writes an append-only `IngredientMovement` row with the previous/new stock values.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: IngredientResponseDto })
  @UseGuards(JwtOrStaffGuard)
  @Post(':id/adjust-stock')
  adjustStock(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: AdjustStockDto,
  ) {
    return this.ingredientsService.adjustStock(actorFrom(req), id, dto);
  }

  @ApiOperation({
    summary: 'Transfer stock between ingredients',
    description:
      'Moves `quantity` from one ingredient (e.g. instore) to another (e.g. outstore). ' +
      'Writes two linked TRANSFER movement rows. Staff are scoped to their store on both sides.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Source ingredient id' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        from: { $ref: '#/components/schemas/IngredientResponseDto' },
        to: { $ref: '#/components/schemas/IngredientResponseDto' },
      },
    },
  })
  @UseGuards(JwtOrStaffGuard)
  @Post(':id/transfer')
  transfer(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: TransferStockDto,
  ) {
    return this.ingredientsService.transfer(actorFrom(req), id, dto);
  }
}
