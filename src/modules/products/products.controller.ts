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
  ApiBody,
} from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto, CreateVariationDto } from './dto/create-product.dto';
import { UpdateProductDto, UpdateVariationDto, ToggleProductStatusDto } from './dto/update-product.dto';
import { FilterProductDto } from './dto/filter-product.dto';
import { LinkIngredientDto } from './dto/link-ingredient.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtOrStaffGuard } from '../../common/guards/jwt-or-staff.guard';
import {
  ProductResponseDto,
  ProductVariationResponseDto,
} from './dto/product-response.dto';

// Reads (`GET`) accept either admin or staff JWTs so the workstation POS can
// load the live menu. Each write method below adds `JwtAuthGuard` to require
// an admin JWT (the per-method guard stacks with the class-level one).
@ApiTags('products')
@ApiBearerAuth()
@UseGuards(JwtOrStaffGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @ApiOperation({ summary: 'Create a product', description: 'Admin-only. Creates a new menu/inventory product.' })
  @ApiCreatedResponse({ type: ProductResponseDto })
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @ApiOperation({ summary: 'List products', description: 'Returns paginated products with optional filters.' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { $ref: '#/components/schemas/ProductResponseDto' } },
        total: { type: 'integer', example: 48 },
        page: { type: 'integer', example: 1 },
        limit: { type: 'integer', example: 20 },
        totalPages: { type: 'integer', example: 3 },
      },
    },
  })
  @Get()
  findAll(@Query() query: FilterProductDto) {
    return this.productsService.findAll(query);
  }

  @ApiOperation({ summary: 'Product statistics', description: 'Returns counts of total, active, and inactive products.' })
  @ApiQuery({ name: 'storeId', required: false, format: 'uuid' })
  @ApiOkResponse({
    schema: {
      example: {
        total: 48,
        active: 45,
        inactive: 3,
        outOfStock: 5,
      },
    },
  })
  @Get('stats')
  getStats(@Query('storeId') storeId?: string) {
    return this.productsService.getStats(storeId);
  }

  @ApiOperation({ summary: 'Get a single product' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ProductResponseDto })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @ApiOperation({ summary: 'Update a product', description: 'Admin-only. Partial update.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ProductResponseDto })
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @ApiOperation({ summary: 'Soft-delete a product', description: 'Admin-only.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  @ApiOperation({ summary: 'Toggle product availability', description: 'Admin-only. Toggles the `status` (active/inactive) flag.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ProductResponseDto })
  @UseGuards(JwtAuthGuard)
  @Patch(':id/status')
  toggleStatus(@Param('id') id: string, @Body() dto: ToggleProductStatusDto) {
    return this.productsService.toggleStatus(id, dto);
  }

  @ApiOperation({ summary: 'Add a variation', description: 'Admin-only. Adds a size/flavour variation to a product.' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Product ID' })
  @ApiCreatedResponse({ type: ProductVariationResponseDto })
  @UseGuards(JwtAuthGuard)
  @Post(':id/variations')
  addVariation(@Param('id') id: string, @Body() dto: CreateVariationDto) {
    return this.productsService.addVariation(id, dto);
  }

  @ApiOperation({ summary: 'Update a variation', description: 'Admin-only.' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Product ID' })
  @ApiParam({ name: 'varId', format: 'uuid', description: 'Variation ID' })
  @ApiOkResponse({ type: ProductVariationResponseDto })
  @UseGuards(JwtAuthGuard)
  @Patch(':id/variations/:varId')
  updateVariation(
    @Param('id') id: string,
    @Param('varId') varId: string,
    @Body() dto: UpdateVariationDto,
  ) {
    return this.productsService.updateVariation(id, varId, dto);
  }

  @ApiOperation({ summary: 'Remove a variation', description: 'Admin-only.' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Product ID' })
  @ApiParam({ name: 'varId', format: 'uuid', description: 'Variation ID' })
  @ApiNoContentResponse()
  @UseGuards(JwtAuthGuard)
  @Delete(':id/variations/:varId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeVariation(@Param('id') id: string, @Param('varId') varId: string) {
    return this.productsService.removeVariation(id, varId);
  }

  @ApiOperation({ summary: 'Link an ingredient', description: 'Admin-only. Associates an ingredient (with quantity) to this product for stock tracking.' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Product ID' })
  @ApiCreatedResponse({ description: 'Ingredient linked.' })
  @UseGuards(JwtAuthGuard)
  @Post(':id/ingredients')
  linkIngredient(@Param('id') id: string, @Body() dto: LinkIngredientDto) {
    return this.productsService.linkIngredient(id, dto);
  }

  @ApiOperation({ summary: 'Unlink an ingredient', description: 'Admin-only.' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Product ID' })
  @ApiParam({ name: 'ingId', format: 'uuid', description: 'Ingredient ID' })
  @ApiNoContentResponse()
  @UseGuards(JwtAuthGuard)
  @Delete(':id/ingredients/:ingId')
  @HttpCode(HttpStatus.NO_CONTENT)
  unlinkIngredient(@Param('id') id: string, @Param('ingId') ingId: string) {
    return this.productsService.unlinkIngredient(id, ingId);
  }

  @ApiOperation({ summary: 'Link an addon group', description: 'Admin-only. Links an addon group to this product so customers can customise their order.' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Product ID' })
  @ApiBody({ schema: { type: 'object', properties: { groupId: { type: 'string', format: 'uuid', example: 'g1h2i3j4-1234-4f1a-8c3e-9a4f0c4e2b21' } }, required: ['groupId'] } })
  @ApiOkResponse({ description: 'Addon group linked.' })
  @UseGuards(JwtAuthGuard)
  @Post(':id/addons')
  linkAddonGroup(@Param('id') id: string, @Body('groupId') groupId: string) {
    return this.productsService.linkAddonGroup(id, groupId);
  }

  @ApiOperation({ summary: 'Unlink an addon group', description: 'Admin-only.' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Product ID' })
  @ApiParam({ name: 'groupId', format: 'uuid', description: 'Addon Group ID' })
  @ApiNoContentResponse()
  @UseGuards(JwtAuthGuard)
  @Delete(':id/addons/:groupId')
  @HttpCode(HttpStatus.NO_CONTENT)
  unlinkAddonGroup(@Param('id') id: string, @Param('groupId') groupId: string) {
    return this.productsService.unlinkAddonGroup(id, groupId);
  }
}
