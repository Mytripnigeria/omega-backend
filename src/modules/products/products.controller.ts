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
import { ProductsService } from './products.service';
import { CreateProductDto, CreateVariationDto } from './dto/create-product.dto';
import { UpdateProductDto, UpdateVariationDto, ToggleProductStatusDto } from './dto/update-product.dto';
import { FilterProductDto } from './dto/filter-product.dto';
import { LinkIngredientDto } from './dto/link-ingredient.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Get()
  findAll(@Query() query: FilterProductDto) {
    return this.productsService.findAll(query);
  }

  @Get('stats')
  getStats(@Query('storeId') storeId?: string) {
    return this.productsService.getStats(storeId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  @Patch(':id/status')
  toggleStatus(@Param('id') id: string, @Body() dto: ToggleProductStatusDto) {
    return this.productsService.toggleStatus(id, dto);
  }

  @Post(':id/variations')
  addVariation(@Param('id') id: string, @Body() dto: CreateVariationDto) {
    return this.productsService.addVariation(id, dto);
  }

  @Patch(':id/variations/:varId')
  updateVariation(
    @Param('id') id: string,
    @Param('varId') varId: string,
    @Body() dto: UpdateVariationDto,
  ) {
    return this.productsService.updateVariation(id, varId, dto);
  }

  @Delete(':id/variations/:varId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeVariation(@Param('id') id: string, @Param('varId') varId: string) {
    return this.productsService.removeVariation(id, varId);
  }

  @Post(':id/ingredients')
  linkIngredient(@Param('id') id: string, @Body() dto: LinkIngredientDto) {
    return this.productsService.linkIngredient(id, dto);
  }

  @Delete(':id/ingredients/:ingId')
  @HttpCode(HttpStatus.NO_CONTENT)
  unlinkIngredient(@Param('id') id: string, @Param('ingId') ingId: string) {
    return this.productsService.unlinkIngredient(id, ingId);
  }

  @Post(':id/addons')
  linkAddonGroup(@Param('id') id: string, @Body('groupId') groupId: string) {
    return this.productsService.linkAddonGroup(id, groupId);
  }

  @Delete(':id/addons/:groupId')
  @HttpCode(HttpStatus.NO_CONTENT)
  unlinkAddonGroup(@Param('id') id: string, @Param('groupId') groupId: string) {
    return this.productsService.unlinkAddonGroup(id, groupId);
  }
}
