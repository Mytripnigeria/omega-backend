import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
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
import { OrderItemEntity } from '../orders/entities/order-item.entity';

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
    @InjectRepository(OrderItemEntity)
    private readonly orderItemRepo: Repository<OrderItemEntity>,
  ) {}

  @ApiOperation({
    summary: 'Store availability',
    description:
      'Returns the bookable time slots for a given store on a date, derived from ' +
      '`store.openingHours`. Used by the storefront time picker.',
  })
  @ApiParam({ name: 'storeId', format: 'uuid' })
  @ApiQuery({ name: 'businessId', format: 'uuid' })
  @ApiQuery({
    name: 'date',
    required: false,
    example: '2026-05-10',
    description: 'YYYY-MM-DD; defaults to today (in the store\'s local time).',
  })
  @Get('stores/:storeId/availability')
  async availability(
    @Param('storeId') storeId: string,
    @Query('businessId') businessId: string,
    @Query('date') date?: string,
  ) {
    if (!businessId) throw new BadRequestException('businessId is required');
    const store = await this.storeRepo.findOne({
      where: { id: storeId, businessId, isActive: true },
    });
    if (!store) throw new BadRequestException('Store not found');
    return this.computeAvailability(store, date);
  }

  private computeAvailability(
    store: StoreEntity,
    isoDate?: string,
  ): { date: string; asapAvailable: boolean; slots: { startsAt: string; endsAt: string }[] } {
    const now = new Date();
    const target = isoDate ? new Date(`${isoDate}T00:00:00`) : new Date(now);
    target.setHours(0, 0, 0, 0);
    const dateStr = target.toISOString().slice(0, 10);
    const isToday = dateStr === now.toISOString().slice(0, 10);

    const dayKeys = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ] as const;
    const day = dayKeys[target.getDay()];
    const slot = store.openingHours?.[day];

    // No hours configured — assume always open during business hours.
    if (!slot || slot.closed) {
      return { date: dateStr, asapAvailable: false, slots: [] };
    }

    const [oh, om] = slot.open.split(':').map((n) => parseInt(n, 10));
    const [ch, cm] = slot.close.split(':').map((n) => parseInt(n, 10));
    const stepMin = 30;
    const slots: { startsAt: string; endsAt: string }[] = [];

    // Scheduling window is intentionally tighter than the raw opening hours:
    // the first selectable time is 30 min AFTER opening and the last slot must
    // end no later than 30 min BEFORE closing (kitchen prep / wind-down buffer).
    const earliest = new Date(target);
    earliest.setHours(oh, om, 0, 0);
    earliest.setTime(earliest.getTime() + stepMin * 60_000);
    const lastEnd = new Date(target);
    lastEnd.setHours(ch, cm, 0, 0);
    lastEnd.setTime(lastEnd.getTime() - stepMin * 60_000);

    let cursor = new Date(earliest);
    if (isToday && cursor < now) {
      // Round up to the next 30-min mark from now, but never before `earliest`.
      const nowRounded = new Date(now);
      nowRounded.setSeconds(0, 0);
      const minsPast = nowRounded.getMinutes() % stepMin;
      if (minsPast > 0) nowRounded.setMinutes(nowRounded.getMinutes() + (stepMin - minsPast));
      if (nowRounded > cursor) cursor = nowRounded;
    }
    while (cursor.getTime() + stepMin * 60_000 <= lastEnd.getTime()) {
      const next = new Date(cursor.getTime() + stepMin * 60_000);
      slots.push({ startsAt: cursor.toISOString(), endsAt: next.toISOString() });
      cursor = next;
    }

    const openMs = new Date(target).setHours(oh, om, 0, 0);
    const closeMs = new Date(target).setHours(ch, cm, 0, 0);
    const asapAvailable =
      isToday && now.getTime() >= openMs && now.getTime() < closeMs;

    return { date: dateStr, asapAvailable, slots };
  }

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
      // visibility is a simple-array column (CSV of channels: pos, self,
      // storefront, ubereats). Treat a null/empty list as "visible
      // everywhere" for legacy products; otherwise require 'storefront' to
      // be one of the comma-separated values.
      .andWhere(
        "(p.visibility IS NULL OR p.visibility = '' OR (',' || p.visibility || ',') LIKE '%,storefront,%')",
      )
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
    // Respect the merchant's per-channel visibility flag. Null/empty list =
    // visible everywhere (legacy default).
    if (
      product.visibility &&
      product.visibility.length > 0 &&
      !product.visibility.includes('storefront')
    ) {
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
      // Load each item's product so the storefront can list the selected
      // products (with names/prices) and show the original price + savings.
      relations: ['items', 'items.product'],
      order: { createdAt: 'DESC' },
    });
    return combos.map(ComboResponseDto.from);
  }

  @ApiOperation({
    summary: 'Product recommendations',
    description:
      'Returns products most frequently ordered alongside `productId` for the store ' +
      '(market-basket). Without `productId`, returns the store\'s top sellers. Falls back ' +
      'to top sellers when co-order history is thin.',
  })
  @ApiQuery({ name: 'businessId', format: 'uuid' })
  @ApiQuery({ name: 'storeId', format: 'uuid' })
  @ApiQuery({ name: 'productId', required: false, format: 'uuid' })
  @ApiQuery({ name: 'limit', required: false, example: 4 })
  @Get('recommendations')
  async recommendations(
    @Query('businessId') businessId: string,
    @Query('storeId') storeId: string,
    @Query('productId') productId?: string,
    @Query('limit') limit?: string,
  ) {
    if (!businessId || !storeId)
      throw new BadRequestException('businessId and storeId are required');
    await this.assertStore(businessId, storeId);
    const take = Math.min(Math.max(parseInt(limit ?? '4', 10) || 4, 1), 12);

    const rankedIds: string[] = [];

    // 1. Market-basket: products co-ordered with the seed product.
    if (productId) {
      const rows = await this.orderItemRepo
        .createQueryBuilder('oi')
        .select('oi.productId', 'productId')
        .addSelect('SUM(oi.quantity)', 'freq')
        .innerJoin('orders', 'o', 'o.id = oi.orderId')
        .innerJoin(
          'order_items',
          'seed',
          'seed.orderId = oi.orderId AND seed.productId = :productId',
          { productId },
        )
        .where('o.storeId = :storeId', { storeId })
        .andWhere('oi.productId IS NOT NULL')
        .andWhere('oi.productId != :productId', { productId })
        .groupBy('oi.productId')
        .orderBy('freq', 'DESC')
        .limit(take)
        .getRawMany<{ productId: string }>();
      rankedIds.push(...rows.map((r) => r.productId));
    }

    // 2. Fallback / top-up with overall top sellers for the store.
    if (rankedIds.length < take) {
      const exclude = [...rankedIds, ...(productId ? [productId] : [])];
      const qb = this.orderItemRepo
        .createQueryBuilder('oi')
        .select('oi.productId', 'productId')
        .addSelect('SUM(oi.quantity)', 'freq')
        .innerJoin('orders', 'o', 'o.id = oi.orderId')
        .where('o.storeId = :storeId', { storeId })
        .andWhere('oi.productId IS NOT NULL')
        .groupBy('oi.productId')
        .orderBy('freq', 'DESC')
        .limit(take * 2);
      if (exclude.length)
        qb.andWhere('oi.productId NOT IN (:...exclude)', { exclude });
      const rows = await qb.getRawMany<{ productId: string }>();
      for (const r of rows) {
        if (rankedIds.length >= take) break;
        if (!rankedIds.includes(r.productId)) rankedIds.push(r.productId);
      }
    }

    if (rankedIds.length === 0) return [];

    // Hydrate full products (active + storefront-visible only) and preserve rank order.
    const products = await this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.variations', 'variations')
      .leftJoinAndSelect('p.addonGroups', 'addonGroups')
      .leftJoinAndSelect('addonGroups.addons', 'addons')
      .where('p.id IN (:...ids)', { ids: rankedIds })
      .andWhere('p.storeId = :storeId', { storeId })
      .andWhere('p.status = true')
      .andWhere(
        "(p.visibility IS NULL OR p.visibility = '' OR (',' || p.visibility || ',') LIKE '%,storefront,%')",
      )
      .getMany();

    const byId = new Map(products.map((p) => [p.id, p]));
    return rankedIds
      .map((id) => byId.get(id))
      .filter((p): p is ProductEntity => !!p)
      .map(ProductResponseDto.from);
  }

  private async assertStore(businessId: string, storeId: string): Promise<void> {
    const store = await this.storeRepo.findOne({
      where: { id: storeId, businessId },
    });
    if (!store) throw new BadRequestException('Store not found for this business');
  }
}
