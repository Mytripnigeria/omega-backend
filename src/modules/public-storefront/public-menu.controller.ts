import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductEntity } from '../products/entities/product.entity';
import { ProductResponseDto } from '../products/dto/product-response.dto';
import { CategoryEntity } from '../categories/entities/category.entity';
import { CategoryResponseDto } from '../categories/dto/category-response.dto';
import { ComboEntity } from '../combos/entities/combo.entity';
import { ComboResponseDto } from '../combos/dto/combo-response.dto';
import { StoreEntity } from '../store/entities/store.entity';
import { StoreResponseDto } from '../store/dto/store-response.dto';

@ApiTags('public-storefront')
@Controller('public/storefront')
export class PublicMenuController {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(CategoryEntity)
    private readonly categoryRepo: Repository<CategoryEntity>,
    @InjectRepository(ComboEntity)
    private readonly comboRepo: Repository<ComboEntity>,
    @InjectRepository(StoreEntity)
    private readonly storeRepo: Repository<StoreEntity>,
  ) {}

  @ApiOperation({
    summary: 'List active stores',
    description: 'Returns active stores for the business — used for pickup/delivery selection.',
  })
  @ApiQuery({ name: 'businessId', format: 'uuid' })
  @Get('stores')
  async stores(@Query('businessId') businessId: string) {
    if (!businessId) throw new BadRequestException('businessId is required');
    const stores = await this.storeRepo.find({
      where: { businessId, isActive: true },
      order: { name: 'ASC' },
    });
    return stores.map(StoreResponseDto.from);
  }

  @ApiOperation({
    summary: 'List menu categories',
    description: 'Returns active menu categories for the given business.',
  })
  @ApiQuery({ name: 'businessId', format: 'uuid' })
  @Get('menu/categories')
  async categories(@Query('businessId') businessId: string) {
    if (!businessId) throw new BadRequestException('businessId is required');
    const cats = await this.categoryRepo.find({
      where: { businessId, isActive: true },
      order: { order: 'ASC', createdAt: 'ASC' },
    });
    return cats.map(CategoryResponseDto.from);
  }

  @ApiOperation({
    summary: 'List menu products',
    description: 'Returns active products for the given store. Includes variations + addons + ingredient links.',
  })
  @ApiQuery({ name: 'businessId', format: 'uuid' })
  @ApiQuery({ name: 'storeId', format: 'uuid' })
  @ApiQuery({ name: 'categoryId', required: false, format: 'uuid' })
  @ApiQuery({ name: 'search', required: false })
  @Get('menu/products')
  async products(
    @Query('businessId') businessId: string,
    @Query('storeId') storeId: string,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
  ) {
    if (!businessId || !storeId)
      throw new BadRequestException('businessId and storeId are required');
    await this.assertStore(businessId, storeId);

    const qb = this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.variations', 'variations')
      .leftJoinAndSelect('p.productIngredients', 'pi')
      .leftJoinAndSelect('pi.ingredient', 'ingredient')
      .leftJoinAndSelect('p.addonGroups', 'addonGroups')
      .leftJoinAndSelect('addonGroups.addons', 'addons')
      .where('p.storeId = :storeId', { storeId })
      .andWhere('p.status = true')
      .orderBy('p.createdAt', 'DESC');

    if (categoryId) qb.andWhere('p.categoryId = :categoryId', { categoryId });
    if (search) qb.andWhere('p.name ILIKE :q', { q: `%${search}%` });

    const products = await qb.getMany();
    return products.map(ProductResponseDto.from);
  }

  @ApiOperation({ summary: 'Get a single product (public)' })
  @ApiQuery({ name: 'businessId', format: 'uuid' })
  @Get('menu/products/:id')
  async product(
    @Param('id') id: string,
    @Query('businessId') businessId: string,
  ) {
    if (!businessId) throw new BadRequestException('businessId is required');
    const product = await this.productRepo.findOne({
      where: { id },
      relations: [
        'variations',
        'productIngredients',
        'productIngredients.ingredient',
        'addonGroups',
        'addonGroups.addons',
      ],
    });
    if (!product || !product.status) {
      throw new BadRequestException('Product not available');
    }
    // Verify the product's store belongs to the requested business
    const store = await this.storeRepo.findOne({
      where: { id: product.storeId, businessId },
    });
    if (!store) throw new BadRequestException('Product not available');
    return ProductResponseDto.from(product);
  }

  @ApiOperation({
    summary: 'List active combos',
    description: 'Returns active combo deals for the given store.',
  })
  @ApiQuery({ name: 'businessId', format: 'uuid' })
  @ApiQuery({ name: 'storeId', format: 'uuid' })
  @Get('menu/combos')
  async combos(
    @Query('businessId') businessId: string,
    @Query('storeId') storeId: string,
  ) {
    if (!businessId || !storeId)
      throw new BadRequestException('businessId and storeId are required');
    await this.assertStore(businessId, storeId);

    const combos = await this.comboRepo.find({
      where: { storeId, isActive: true },
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });
    return combos.map(ComboResponseDto.from);
  }

  private async assertStore(businessId: string, storeId: string): Promise<void> {
    const store = await this.storeRepo.findOne({
      where: { id: storeId, businessId },
    });
    if (!store) throw new BadRequestException('Store not found for this business');
  }
}
