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
import { DeliveryRegionEntity } from '../delivery-regions/entities/delivery-region.entity';
import { DeliveryRegionResponseDto } from '../delivery-regions/dto/delivery-region.dto';
import { AutomaticDiscountsService } from '../coupons/automatic-discounts.service';

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
    @InjectRepository(DeliveryRegionEntity)
    private readonly deliveryRegionRepo: Repository<DeliveryRegionEntity>,
    private readonly automaticDiscounts: AutomaticDiscountsService,
  ) {}

  /**
   * Prices a storefront listing with any automatic discount the merchant has
   * running. The shelf price stays on `sellingPrice`; the discount rides
   * alongside it so the page can show the old price struck through next to the
   * new one, the way every shop online does it.
   */
  private async withDiscounts(
    businessId: string,
    products: ProductEntity[],
  ): Promise<ProductResponseDto[]> {
    const dtos = products.map(ProductResponseDto.from);
    const running = await this.automaticDiscounts.activeFor(businessId);
    if (running.length === 0) return dtos;
    for (const [i, dto] of dtos.entries()) {
      const product = products[i];
      const on = { id: product.id, categoryId: product.categoryId };
      const base = Number(product.sellingPrice ?? product.price ?? 0);
      dto.discount = AutomaticDiscountsService.bestFor(running, on, base) ?? null;
      // A size replaces the base price, so it needs its own figure — otherwise
      // picking "Large" would quietly show the undiscounted price.
      for (const variation of dto.variations ?? []) {
        const vBase = Number(variation.sellingPrice ?? variation.price ?? 0);
        variation.discount =
          AutomaticDiscountsService.bestFor(running, on, vBase) ?? null;
      }
    }
    return dtos;
  }

  @ApiOperation({
    summary: 'Delivery regions for a store',
    description:
      'Active delivery regions and their fees, so checkout can make the customer ' +
      'pick one and show the real delivery fee before paying.',
  })
  @ApiParam({ name: 'storeId', format: 'uuid' })
  @Get('stores/:storeId/delivery-regions')
  async deliveryRegions(@Param('storeId') storeId: string) {
    const rows = await this.deliveryRegionRepo.find({
      where: { storeId, isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
    return rows.map(DeliveryRegionResponseDto.from);
  }

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
    // Format the date from LOCAL components, not toISOString(): the process
    // runs on the merchant's timezone (Africa/Lagos), so toISOString() would
    // shift local midnight back into the previous UTC day and make `isToday`
    // wrong — which stopped past slots being trimmed and broke ASAP gating.
    const localDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate(),
      ).padStart(2, '0')}`;
    const dateStr = localDate(target);
    const isToday = dateStr === localDate(now);

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
    // A store with NO opening hours at all is unrestricted, which is exactly
    // how order placement treats it. This used to answer "closed, no slots"
    // for such a store, so the storefront offered no time to pick and refused
    // to place an order the API would have accepted — while the header badge
    // still read "Open". The two rules have to agree.
    const slot = store.openingHours
      ? store.openingHours[day]
      : { open: '00:00', close: '23:59', closed: false };

    // A day the merchant marked closed (or left out of a configured week) is
    // genuinely closed.
    if (!slot || slot.closed) {
      return { date: dateStr, asapAvailable: false, slots: [] };
    }

    const [oh, om] = slot.open.split(':').map((n) => parseInt(n, 10));
    const [ch, cm] = slot.close.split(':').map((n) => parseInt(n, 10));
    const stepMin = 30;
    const slots: { startsAt: string; endsAt: string }[] = [];

    // Scheduling window is intentionally tighter than the raw opening hours:
    // the first selectable time is 30 min AFTER opening and the last selectable
    // time is 30 min BEFORE closing (kitchen prep / wind-down buffer).
    const earliest = new Date(target);
    earliest.setHours(oh, om, 0, 0);
    earliest.setTime(earliest.getTime() + stepMin * 60_000);
    const lastStart = new Date(target);
    lastStart.setHours(ch, cm, 0, 0);
    lastStart.setTime(lastStart.getTime() - stepMin * 60_000);

    let cursor = new Date(earliest);
    if (isToday && cursor < now) {
      // Round up to the next 30-min mark from now, but never before `earliest`.
      const nowRounded = new Date(now);
      nowRounded.setSeconds(0, 0);
      const minsPast = nowRounded.getMinutes() % stepMin;
      if (minsPast > 0) nowRounded.setMinutes(nowRounded.getMinutes() + (stepMin - minsPast));
      if (nowRounded > cursor) cursor = nowRounded;
    }
    while (cursor.getTime() <= lastStart.getTime()) {
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
  async categories(
    @Query('businessId') businessId: string,
    @Query('storeId') storeId?: string,
  ) {
    if (!businessId) throw new BadRequestException('businessId is required');
    // Categories are store-scoped — when the storefront passes its resolved
    // store, return only that store's categories.
    const cats = await this.categoryRepo.find({
      where: storeId
        ? { businessId, storeId, isActive: true }
        : { businessId, isActive: true },
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
    return this.withDiscounts(businessId, products);
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
    return (await this.withDiscounts(businessId, [product]))[0];
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
    // Priced like every other list: a recommendation card showing the shelf
    // price next to a menu card showing the promotional one is the drift this
    // whole path exists to prevent.
    return this.withDiscounts(
      businessId,
      rankedIds
        .map((id) => byId.get(id))
        .filter((p): p is ProductEntity => !!p),
    );
  }

  private async assertStore(businessId: string, storeId: string): Promise<void> {
    const store = await this.storeRepo.findOne({
      where: { id: storeId, businessId },
    });
    if (!store) throw new BadRequestException('Store not found for this business');
  }
}
