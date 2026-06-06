import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderEntity, OrderStatus } from '../orders/entities/order.entity';
import { OrderItemEntity } from '../orders/entities/order-item.entity';
import { OrderStatusEventEntity } from '../orders/entities/order-status-event.entity';
import {
  DeliveryEntity,
  DeliveryStatus,
} from '../deliveries/entities/delivery.entity';
import { ShiftEntity, ShiftStatus } from '../shifts/entities/shift.entity';
import { IngredientEntity } from '../ingredients/entities/ingredient.entity';
import {
  ExpenseEntity,
  ExpenseStatus,
} from '../expenses/entities/expense.entity';
import { CustomerEntity } from '../customers/entities/customer.entity';
import { CashSessionEntity } from '../cash-sessions/entities/cash-session.entity';
import { ProductEntity } from '../products/entities/product.entity';
import { CategoryEntity } from '../categories/entities/category.entity';
import {
  IngredientMovementEntity,
  MovementType,
} from '../ingredients/entities/ingredient-movement.entity';
import {
  ReportsRangeDto,
  SalesReportFilterDto,
  DashboardSummaryFilterDto,
  TopProductsFilterDto,
} from './dto/reports-filter.dto';
import {
  DashboardSummaryDto,
  DeliveryStatsDto,
  FoodCostCategoryRowDto,
  FoodCostItemRowDto,
  FoodCostReportDto,
  KitchenStatsDto,
  SalesReportDto,
  StaffPerformanceDto,
  StaffPerformanceRowDto,
  SalesReportBucketDto,
  StockReportDto,
  StockReportRowDto,
  StockStatus,
  TopProductRowDto,
  TopProductsReportDto,
  WasteIngredientRowDto,
  WasteLogRowDto,
  WasteReasonRowDto,
  WasteReportDto,
} from './dto/reports-response.dto';

interface ActorContext {
  sub: string;
  sub_type: 'admin' | 'staff';
  businessId: string;
  storeId?: string;
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    @InjectRepository(OrderItemEntity)
    private readonly itemRepo: Repository<OrderItemEntity>,
    @InjectRepository(OrderStatusEventEntity)
    private readonly orderEventRepo: Repository<OrderStatusEventEntity>,
    @InjectRepository(DeliveryEntity)
    private readonly deliveryRepo: Repository<DeliveryEntity>,
    @InjectRepository(ShiftEntity)
    private readonly shiftRepo: Repository<ShiftEntity>,
    @InjectRepository(IngredientEntity)
    private readonly ingredientRepo: Repository<IngredientEntity>,
    @InjectRepository(ExpenseEntity)
    private readonly expenseRepo: Repository<ExpenseEntity>,
    @InjectRepository(CustomerEntity)
    private readonly customerRepo: Repository<CustomerEntity>,
    @InjectRepository(CashSessionEntity)
    private readonly cashSessionRepo: Repository<CashSessionEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(CategoryEntity)
    private readonly categoryRepo: Repository<CategoryEntity>,
    @InjectRepository(IngredientMovementEntity)
    private readonly movementRepo: Repository<IngredientMovementEntity>,
  ) {}

  // ----- helpers -----

  private dateBound(filter: ReportsRangeDto): { from: Date; to: Date } {
    const now = new Date();
    const defaultFrom = new Date(now);
    defaultFrom.setDate(defaultFrom.getDate() - 30);
    const from = filter.dateFrom ? new Date(filter.dateFrom) : defaultFrom;
    const to = filter.dateTo
      ? new Date(`${filter.dateTo}T23:59:59`)
      : new Date(now);
    return { from, to };
  }

  private effectiveStoreId(actor: ActorContext, requested?: string): string | undefined {
    if (actor.sub_type === 'staff' && actor.storeId) return actor.storeId;
    return requested;
  }

  // ----- sales -----

  async getSalesReport(
    actor: ActorContext,
    filter: SalesReportFilterDto,
  ): Promise<SalesReportDto> {
    const { from, to } = this.dateBound(filter);
    const storeId = this.effectiveStoreId(actor, filter.storeId);
    const groupBy = filter.groupBy ?? 'day';
    const truncUnit =
      groupBy === 'month'
        ? 'month'
        : groupBy === 'week'
          ? 'week'
          : groupBy === 'hour'
            ? 'hour'
            : 'day';

    const qb = this.orderRepo
      .createQueryBuilder('o')
      .where('o.businessId = :bid', { bid: actor.businessId })
      .andWhere('o.status NOT IN (:...excluded)', {
        excluded: [OrderStatus.CANCELLED],
      })
      .andWhere('o.createdAt >= :from', { from })
      .andWhere('o.createdAt <= :to', { to });
    if (storeId) qb.andWhere('o.storeId = :sid', { sid: storeId });

    // Bucketed totals (date_trunc).
    const bucketRows = await qb
      .clone()
      .select(`DATE_TRUNC('${truncUnit}', o.createdAt)`, 'bucket')
      .addSelect('COUNT(o.id)', 'orders')
      .addSelect('COALESCE(SUM(o.total), 0)', 'revenue')
      .groupBy('bucket')
      .orderBy('bucket', 'ASC')
      .getRawMany<{ bucket: Date; orders: string; revenue: string }>();

    // Channel breakdown per bucket.
    const channelRows = await qb
      .clone()
      .select(`DATE_TRUNC('${truncUnit}', o.createdAt)`, 'bucket')
      .addSelect('o.channel', 'channel')
      .addSelect('COALESCE(SUM(o.total), 0)', 'revenue')
      .groupBy('bucket')
      .addGroupBy('o.channel')
      .getRawMany<{ bucket: Date; channel: string; revenue: string }>();

    const channelByBucket = new Map<number, Record<string, number>>();
    const totalByChannel: Record<string, number> = {};
    for (const r of channelRows) {
      const key = new Date(r.bucket).getTime();
      const slot = channelByBucket.get(key) ?? {};
      slot[r.channel] = Number(r.revenue);
      channelByBucket.set(key, slot);
      totalByChannel[r.channel] =
        (totalByChannel[r.channel] ?? 0) + Number(r.revenue);
    }

    // Item counts per bucket via join.
    const itemRows = await this.itemRepo
      .createQueryBuilder('i')
      .innerJoin('i.order', 'o')
      .where('o.businessId = :bid', { bid: actor.businessId })
      .andWhere('o.status NOT IN (:...excluded)', {
        excluded: [OrderStatus.CANCELLED],
      })
      .andWhere('o.createdAt >= :from', { from })
      .andWhere('o.createdAt <= :to', { to })
      .andWhere(storeId ? 'o.storeId = :sid' : '1=1', { sid: storeId })
      .select(`DATE_TRUNC('${truncUnit}', o.createdAt)`, 'bucket')
      .addSelect('COALESCE(SUM(i.quantity), 0)', 'items')
      .groupBy('bucket')
      .getRawMany<{ bucket: Date; items: string }>();

    const itemMap = new Map<number, number>();
    for (const r of itemRows) itemMap.set(new Date(r.bucket).getTime(), Number(r.items));

    const buckets: SalesReportBucketDto[] = bucketRows.map((r) => {
      const bucketDate = new Date(r.bucket);
      return {
        bucket: bucketDate.toISOString().split('T')[0],
        orders: Number(r.orders),
        items: itemMap.get(bucketDate.getTime()) ?? 0,
        revenue: Number(r.revenue),
        byChannel: channelByBucket.get(bucketDate.getTime()) ?? {},
      };
    });

    const totalOrders = buckets.reduce((s, b) => s + b.orders, 0);
    const totalItems = buckets.reduce((s, b) => s + b.items, 0);
    const totalRevenue = buckets.reduce((s, b) => s + b.revenue, 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return {
      totalOrders,
      totalItems,
      totalRevenue,
      averageOrderValue,
      buckets,
      byChannel: totalByChannel,
    };
  }

  // ----- top products -----

  async getTopProducts(
    actor: ActorContext,
    filter: TopProductsFilterDto,
  ): Promise<TopProductsReportDto> {
    const { from, to } = this.dateBound(filter);
    const storeId = this.effectiveStoreId(actor, filter.storeId);
    const limit = filter.limit ?? 5;

    const qb = this.itemRepo
      .createQueryBuilder('i')
      .innerJoin('i.order', 'o')
      .where('o.businessId = :bid', { bid: actor.businessId })
      .andWhere('o.status NOT IN (:...excluded)', {
        excluded: [OrderStatus.CANCELLED],
      })
      .andWhere('o.createdAt >= :from', { from })
      .andWhere('o.createdAt <= :to', { to })
      .andWhere('i.productId IS NOT NULL')
      .select('i.productId', 'productId')
      .addSelect('MAX(i.name)', 'name')
      .addSelect('COALESCE(SUM(i.quantity), 0)', 'unitsSold')
      .addSelect('COUNT(DISTINCT o.id)', 'ordersCount')
      .addSelect('COALESCE(SUM(i.subtotal), 0)', 'revenue')
      .groupBy('i.productId')
      .orderBy('revenue', 'DESC')
      .limit(limit);
    if (storeId) qb.andWhere('o.storeId = :sid', { sid: storeId });

    const rows = await qb.getRawMany<{
      productId: string;
      name: string;
      unitsSold: string;
      ordersCount: string;
      revenue: string;
    }>();

    // Resolve categoryId in one round-trip by looking up the products.
    const productIds = rows.map((r) => r.productId).filter(Boolean);
    const categoryByProduct = new Map<string, string | null>();
    if (productIds.length > 0) {
      const productRows = await this.itemRepo.manager
        .createQueryBuilder()
        .from('products', 'p')
        .select('p.id', 'id')
        .addSelect('p."categoryId"', 'categoryId')
        .where('p.id IN (:...ids)', { ids: productIds })
        .getRawMany<{ id: string; categoryId: string | null }>();
      for (const p of productRows) categoryByProduct.set(p.id, p.categoryId);
    }

    return {
      rows: rows.map(
        (r): TopProductRowDto => ({
          productId: r.productId,
          name: r.name,
          categoryId: categoryByProduct.get(r.productId) ?? null,
          unitsSold: Number(r.unitsSold),
          ordersCount: Number(r.ordersCount),
          revenue: Number(r.revenue),
        }),
      ),
    };
  }

  // ----- food cost -----

  /**
   * Food-cost analysis derived from completed-order line items.
   *
   * Cost basis: sum(qty × product.price) — `price` on ProductEntity stores
   *   the cost price.
   * Revenue basis: sum(orderItem.subtotal) — the customer's actual paid
   *   amount per line at order time (variations/addons already baked in).
   *
   * The same rollup is computed three ways:
   *   1. Overall — single totals (the stat tiles).
   *   2. By category — joined via products.categoryId.
   *   3. By item — grouped by productId.
   *
   * Only COMPLETED orders are counted (cancelled/in-flight orders haven't
   * actually used inventory and shouldn't skew the % view).
   */
  async getFoodCostReport(
    actor: ActorContext,
    filter: ReportsRangeDto,
  ): Promise<FoodCostReportDto> {
    const { from, to } = this.dateBound(filter);
    const storeId = this.effectiveStoreId(actor, filter.storeId);

    type ItemRaw = {
      productId: string;
      name: string;
      categoryId: string | null;
      costPrice: string;
      sellingPrice: string;
      unitsSold: string;
      totalCost: string;
      totalRevenue: string;
    };

    const qb = this.itemRepo
      .createQueryBuilder('i')
      .innerJoin('i.order', 'o')
      .innerJoin(ProductEntity, 'p', 'p.id = i.productId')
      .where('o.businessId = :bid', { bid: actor.businessId })
      .andWhere('o.status = :status', { status: OrderStatus.COMPLETED })
      .andWhere('o.createdAt >= :from', { from })
      .andWhere('o.createdAt <= :to', { to })
      .andWhere('i.productId IS NOT NULL')
      .select('i.productId', 'productId')
      .addSelect('MAX(p.name)', 'name')
      .addSelect('MAX(p.categoryId)', 'categoryId')
      .addSelect('MAX(p.price)', 'costPrice')
      .addSelect('MAX(p.sellingPrice)', 'sellingPrice')
      .addSelect('COALESCE(SUM(i.quantity), 0)', 'unitsSold')
      .addSelect('COALESCE(SUM(i.quantity * p.price), 0)', 'totalCost')
      .addSelect('COALESCE(SUM(i.subtotal), 0)', 'totalRevenue')
      .groupBy('i.productId');
    if (storeId) qb.andWhere('o.storeId = :sid', { sid: storeId });

    const itemRows = await qb.getRawMany<ItemRaw>();

    // Resolve category names in one round-trip.
    const categoryIds = Array.from(
      new Set(itemRows.map((r) => r.categoryId).filter((c): c is string => !!c)),
    );
    const categoryNameById = new Map<string, string>();
    if (categoryIds.length > 0) {
      const cats = await this.categoryRepo.find({
        where: categoryIds.map((id) => ({ id })),
        select: ['id', 'name'],
      });
      for (const c of cats) categoryNameById.set(c.id, c.name);
    }

    let totalCost = 0;
    let totalRevenue = 0;
    let unitsSold = 0;
    for (const r of itemRows) {
      totalCost += Number(r.totalCost);
      totalRevenue += Number(r.totalRevenue);
      unitsSold += Number(r.unitsSold);
    }

    const overallPct =
      totalRevenue > 0 ? Math.round((totalCost / totalRevenue) * 1000) / 10 : 0;

    const byItem: FoodCostItemRowDto[] = itemRows
      .map((r) => {
        const cost = Number(r.totalCost);
        const revenue = Number(r.totalRevenue);
        return {
          productId: r.productId,
          name: r.name,
          categoryId: r.categoryId,
          categoryName: r.categoryId
            ? categoryNameById.get(r.categoryId) ?? null
            : null,
          unitsSold: Number(r.unitsSold),
          costPrice: Number(r.costPrice),
          sellingPrice: Number(r.sellingPrice),
          totalCost: cost,
          totalRevenue: revenue,
          foodCostPct: revenue > 0 ? Math.round((cost / revenue) * 1000) / 10 : 0,
          margin: revenue - cost,
        };
      })
      .sort((a, b) => b.totalCost - a.totalCost);

    // Roll up by category in JS — cheaper than a second query.
    const catAgg = new Map<
      string,
      { name: string; unitsSold: number; totalCost: number; totalRevenue: number }
    >();
    const uncategorizedKey = '__uncategorized__';
    for (const r of byItem) {
      const key = r.categoryId ?? uncategorizedKey;
      const slot = catAgg.get(key) ?? {
        name:
          r.categoryId !== null
            ? r.categoryName ?? 'Uncategorized'
            : 'Uncategorized',
        unitsSold: 0,
        totalCost: 0,
        totalRevenue: 0,
      };
      slot.unitsSold += r.unitsSold;
      slot.totalCost += r.totalCost;
      slot.totalRevenue += r.totalRevenue;
      catAgg.set(key, slot);
    }

    const byCategory: FoodCostCategoryRowDto[] = Array.from(catAgg.entries())
      .map(([key, v]) => ({
        categoryId: key === uncategorizedKey ? null : key,
        name: v.name,
        unitsSold: v.unitsSold,
        totalCost: v.totalCost,
        totalRevenue: v.totalRevenue,
        foodCostPct:
          v.totalRevenue > 0
            ? Math.round((v.totalCost / v.totalRevenue) * 1000) / 10
            : 0,
        margin: v.totalRevenue - v.totalCost,
        shareOfCost:
          totalCost > 0 ? Math.round((v.totalCost / totalCost) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.totalCost - a.totalCost);

    return {
      itemsTracked: itemRows.length,
      unitsSold,
      totalCost,
      totalRevenue,
      foodCostPct: overallPct,
      margin: totalRevenue - totalCost,
      targetPct: null,
      byCategory,
      byItem,
    };
  }

  // ----- waste -----

  /**
   * Waste analysis sourced from ingredient-movement rows tagged as WASTE.
   * Workstation Outstore page logs spoilage / damage / discards through
   * `/ingredients/:id/adjust-stock` with `type: 'waste'` — that's the only
   * write path. The merchant hub is read-only here.
   *
   * Estimated value per movement = |quantity| × ingredient.costPerUnit.
   * Waste % = totalValue / current aggregate inventory value × 100 (a coarse
   * proxy; better than nothing without a SKU-purchase-history join).
   * vsPreviousPct compares against the same-length window immediately before.
   */
  async getWasteReport(
    actor: ActorContext,
    filter: ReportsRangeDto,
  ): Promise<WasteReportDto> {
    const { from, to } = this.dateBound(filter);
    const storeId = this.effectiveStoreId(actor, filter.storeId);

    const baseScope = <
      T extends import('typeorm').SelectQueryBuilder<IngredientMovementEntity>,
    >(qb: T): T => {
      qb.andWhere('m.type = :wasteType', { wasteType: MovementType.WASTE });
      if (storeId) qb.andWhere('m.storeId = :sid', { sid: storeId });
      else
        qb.andWhere(
          'EXISTS (SELECT 1 FROM ingredients i WHERE i.id = m.ingredientId AND i.storeId IN ' +
            '(SELECT s.id FROM stores s WHERE s.businessId = :bid))',
          { bid: actor.businessId },
        );
      return qb;
    };

    const inWindow = <
      T extends import('typeorm').SelectQueryBuilder<IngredientMovementEntity>,
    >(qb: T, fromVal: Date, toVal: Date): T => {
      qb.andWhere('m.createdAt >= :from', { from: fromVal });
      qb.andWhere('m.createdAt <= :to', { to: toVal });
      return qb;
    };

    // Pull all waste movements in the window once; everything else is JS
    // rollup off this single result set.
    const rows = await baseScope(
      inWindow(
        this.movementRepo
          .createQueryBuilder('m')
          .leftJoinAndSelect('m.ingredient', 'ingredient'),
        from,
        to,
      ),
    )
      .orderBy('m.createdAt', 'DESC')
      .getMany();

    let totalValue = 0;
    let totalQuantity = 0;
    const reasonAgg = new Map<
      string,
      { entries: number; totalQuantity: number; estimatedValue: number }
    >();
    const ingredientAgg = new Map<
      string,
      {
        name: string;
        unit: string;
        entries: number;
        totalQuantity: number;
        estimatedValue: number;
      }
    >();
    const logs: WasteLogRowDto[] = [];

    for (const m of rows) {
      const qty = Math.abs(Number(m.quantity));
      const costPerUnit = m.ingredient
        ? Number(
            (m.ingredient as IngredientMovementEntity['ingredient'] & {
              costPerUnit?: number | string;
            }).costPerUnit ?? 0,
          )
        : 0;
      const value = qty * costPerUnit;
      totalQuantity += qty;
      totalValue += value;

      const reasonKey = (m.reason ?? 'Unspecified').trim() || 'Unspecified';
      const r = reasonAgg.get(reasonKey) ?? {
        entries: 0,
        totalQuantity: 0,
        estimatedValue: 0,
      };
      r.entries += 1;
      r.totalQuantity += qty;
      r.estimatedValue += value;
      reasonAgg.set(reasonKey, r);

      const ing = ingredientAgg.get(m.ingredientId) ?? {
        name: m.ingredient?.name ?? 'Unknown ingredient',
        unit: m.ingredient?.unit ?? '',
        entries: 0,
        totalQuantity: 0,
        estimatedValue: 0,
      };
      ing.entries += 1;
      ing.totalQuantity += qty;
      ing.estimatedValue += value;
      ingredientAgg.set(m.ingredientId, ing);

      if (logs.length < 50) {
        logs.push({
          id: m.id,
          ingredientId: m.ingredientId,
          ingredientName: m.ingredient?.name ?? 'Unknown ingredient',
          unit: m.ingredient?.unit ?? '',
          quantity: qty,
          estimatedValue: value,
          reason: m.reason,
          staffId: m.staffId,
          staffName: m.staffName,
          createdAt: m.createdAt.toISOString(),
        });
      }
    }

    // Previous-window comparison: same length immediately before `from`.
    const windowMs = to.getTime() - from.getTime();
    const prevTo = new Date(from.getTime() - 1);
    const prevFrom = new Date(prevTo.getTime() - windowMs);
    const prevRow = await baseScope(
      inWindow(
        this.movementRepo.createQueryBuilder('m'),
        prevFrom,
        prevTo,
      ),
    )
      .leftJoin('m.ingredient', 'ingredient')
      .select('COALESCE(SUM(ABS(m.quantity) * ingredient.costPerUnit), 0)', 'value')
      .getRawOne<{ value: string }>();
    const prevValue = Number(prevRow?.value ?? 0);
    const vsPreviousPct =
      prevValue > 0
        ? Math.round(((totalValue - prevValue) / prevValue) * 1000) / 10
        : 0;

    // Inventory value proxy for waste %: sum(currentStock × costPerUnit) over
    // the same store(s). Rough — best available without a separate purchase
    // ledger.
    const invRow = await this.movementRepo.manager
      .createQueryBuilder()
      .from('ingredients', 'i')
      .select('COALESCE(SUM(i."currentStock" * i."costPerUnit"), 0)', 'value')
      .where(storeId ? 'i.storeId = :sid' : '1=1', { sid: storeId })
      .andWhere(
        storeId
          ? '1=1'
          : 'i.storeId IN (SELECT s.id FROM stores s WHERE s."businessId" = :bid)',
        { bid: actor.businessId },
      )
      .andWhere('i."deletedAt" IS NULL')
      .getRawOne<{ value: string }>();
    const inventoryValue = Number(invRow?.value ?? 0);
    const wastePct =
      inventoryValue > 0
        ? Math.round((totalValue / inventoryValue) * 1000) / 10
        : 0;

    const byReason: WasteReasonRowDto[] = Array.from(reasonAgg.entries())
      .map(([reason, v]) => ({
        reason,
        entries: v.entries,
        totalQuantity: v.totalQuantity,
        estimatedValue: v.estimatedValue,
        share:
          totalValue > 0
            ? Math.round((v.estimatedValue / totalValue) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => b.estimatedValue - a.estimatedValue);

    const byIngredient: WasteIngredientRowDto[] = Array.from(
      ingredientAgg.entries(),
    )
      .map(([ingredientId, v]) => ({
        ingredientId,
        name: v.name,
        unit: v.unit,
        entries: v.entries,
        totalQuantity: v.totalQuantity,
        estimatedValue: v.estimatedValue,
      }))
      .sort((a, b) => b.estimatedValue - a.estimatedValue);

    return {
      entries: rows.length,
      totalValue,
      totalQuantity,
      wastePct,
      vsPreviousPct,
      byReason,
      byIngredient,
      recent: logs,
    };
  }

  // ----- stock -----

  /** Inventory snapshot derived from IngredientEntity. Returns total value,
   *  status counts (good/low/critical/out), expiring-soon count, and a per-
   *  ingredient row table. Staff JWTs auto-scope to their store. */
  async getStockReport(
    actor: ActorContext,
    filter: ReportsRangeDto,
  ): Promise<StockReportDto> {
    const storeId = this.effectiveStoreId(actor, filter.storeId);

    const qb = this.movementRepo.manager
      .createQueryBuilder()
      .from('ingredients', 'i')
      .select('i.id', 'id')
      .addSelect('i.name', 'name')
      .addSelect('i.sku', 'sku')
      .addSelect('i.unit', 'unit')
      .addSelect('i."currentStock"', 'currentStock')
      .addSelect('i."minStock"', 'minStock')
      .addSelect('i."costPerUnit"', 'costPerUnit')
      .addSelect('i."expiryDate"', 'expiryDate')
      .addSelect('i."lastRestocked"', 'lastRestocked')
      .where('i."deletedAt" IS NULL');
    if (storeId) qb.andWhere('i."storeId" = :sid', { sid: storeId });
    else
      qb.andWhere(
        'i."storeId" IN (SELECT s.id FROM stores s WHERE s."businessId" = :bid)',
        { bid: actor.businessId },
      );

    const raw = await qb.orderBy('i.name', 'ASC').getRawMany<{
      id: string;
      name: string;
      sku: string | null;
      unit: string;
      currentStock: string;
      minStock: string;
      costPerUnit: string;
      expiryDate: string | null;
      lastRestocked: Date | null;
    }>();

    const fourteenDays = 14 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    let totalValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let expiringCount = 0;

    const rows: StockReportRowDto[] = raw.map((r) => {
      const current = Number(r.currentStock);
      const min = Number(r.minStock);
      const costPerUnit = Number(r.costPerUnit);
      const value = current * costPerUnit;
      totalValue += value;

      let status: StockStatus;
      if (current <= 0) {
        status = 'out';
        outOfStockCount += 1;
      } else if (min > 0 && current <= min / 2) {
        status = 'critical';
        lowStockCount += 1;
      } else if (current <= min) {
        status = 'low';
        lowStockCount += 1;
      } else {
        status = 'good';
      }

      if (
        r.expiryDate &&
        new Date(r.expiryDate).getTime() - now <= fourteenDays
      ) {
        expiringCount += 1;
      }

      return {
        ingredientId: r.id,
        name: r.name,
        sku: r.sku,
        unit: r.unit,
        currentStock: current,
        minStock: min,
        costPerUnit,
        value,
        status,
        expiryDate: r.expiryDate,
        lastRestocked: r.lastRestocked ? r.lastRestocked.toISOString() : null,
      };
    });

    return {
      totalItems: rows.length,
      totalValue,
      lowStockCount,
      outOfStockCount,
      expiringCount,
      rows,
    };
  }

  // ----- staff performance -----

  async getStaffPerformance(
    actor: ActorContext,
    filter: ReportsRangeDto,
  ): Promise<StaffPerformanceDto> {
    const { from, to } = this.dateBound(filter);
    const storeId = this.effectiveStoreId(actor, filter.storeId);

    const orderQb = this.orderRepo
      .createQueryBuilder('o')
      .where('o.businessId = :bid', { bid: actor.businessId })
      .andWhere('o.staffId IS NOT NULL')
      .andWhere('o.createdAt >= :from', { from })
      .andWhere('o.createdAt <= :to', { to })
      .andWhere('o.status NOT IN (:...excluded)', {
        excluded: [OrderStatus.CANCELLED],
      });
    if (storeId) orderQb.andWhere('o.storeId = :sid', { sid: storeId });

    const orderRows = await orderQb
      .select('o.staffId', 'staffId')
      .addSelect('o.staffName', 'staffName')
      .addSelect('COUNT(o.id)', 'ordersProcessed')
      .addSelect('COALESCE(SUM(o.total), 0)', 'salesAttributed')
      .groupBy('o.staffId')
      .addGroupBy('o.staffName')
      .getRawMany<{
        staffId: string;
        staffName: string | null;
        ordersProcessed: string;
        salesAttributed: string;
      }>();

    // Hours worked from completed shifts.
    const shiftQb = this.shiftRepo
      .createQueryBuilder('s')
      .where('s.actualClockIn IS NOT NULL')
      .andWhere('s.actualClockOut IS NOT NULL')
      .andWhere('s.actualClockIn >= :from', { from })
      .andWhere('s.actualClockOut <= :to', { to });
    if (storeId) shiftQb.andWhere('s.storeId = :sid', { sid: storeId });
    const shiftRows = await shiftQb
      .select('s.staffId', 'staffId')
      .addSelect(
        'COALESCE(SUM(EXTRACT(EPOCH FROM (s.actualClockOut - s.actualClockIn))) / 3600, 0)',
        'hours',
      )
      .groupBy('s.staffId')
      .getRawMany<{ staffId: string; hours: string }>();
    const hoursMap = new Map<string, number>();
    for (const r of shiftRows) hoursMap.set(r.staffId, Number(r.hours));

    // Merge: union of staff who placed orders OR worked shifts.
    const staffIds = new Set<string>([
      ...orderRows.map((r) => r.staffId),
      ...hoursMap.keys(),
    ]);
    const orderMap = new Map<string, { staffName: string | null; orders: number; sales: number }>();
    for (const r of orderRows) {
      orderMap.set(r.staffId, {
        staffName: r.staffName,
        orders: Number(r.ordersProcessed),
        sales: Number(r.salesAttributed),
      });
    }

    const rows: StaffPerformanceRowDto[] = Array.from(staffIds).map((sid) => {
      const o = orderMap.get(sid);
      return {
        staffId: sid,
        staffName: o?.staffName ?? '',
        ordersProcessed: o?.orders ?? 0,
        salesAttributed: o?.sales ?? 0,
        hoursWorked: Number((hoursMap.get(sid) ?? 0).toFixed(2)),
      };
    });
    rows.sort((a, b) => b.salesAttributed - a.salesAttributed);

    return { rows };
  }

  // ----- kitchen -----

  async getKitchenStats(
    actor: ActorContext,
    filter: ReportsRangeDto,
  ): Promise<KitchenStatsDto> {
    const { from, to } = this.dateBound(filter);
    const storeId = this.effectiveStoreId(actor, filter.storeId);

    // Compute prep time as the gap between an order's first PENDING event and its READY event.
    // Approximate by using order.createdAt and the OrderStatusEvent for `to=ready`.
    const baseQb = this.orderRepo
      .createQueryBuilder('o')
      .where('o.businessId = :bid', { bid: actor.businessId })
      .andWhere('o.createdAt >= :from', { from })
      .andWhere('o.createdAt <= :to', { to });
    if (storeId) baseQb.andWhere('o.storeId = :sid', { sid: storeId });

    const ordersServed = await baseQb
      .clone()
      .andWhere('o.status IN (:...statuses)', {
        statuses: [OrderStatus.SERVED, OrderStatus.COMPLETED],
      })
      .getCount();

    const inflight = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.businessId = :bid', { bid: actor.businessId })
      .andWhere(storeId ? 'o.storeId = :sid' : '1=1', { sid: storeId })
      .andWhere('o.status IN (:...statuses)', {
        statuses: [OrderStatus.PREPARING, OrderStatus.READY],
      })
      .getCount();

    const prepRow = await this.orderEventRepo
      .createQueryBuilder('e')
      .innerJoin(OrderEntity, 'o', 'o.id = e.orderId')
      .where('o.businessId = :bid', { bid: actor.businessId })
      .andWhere(storeId ? 'o.storeId = :sid' : '1=1', { sid: storeId })
      .andWhere('e.toStatus = :ready', { ready: OrderStatus.READY })
      .andWhere('o.createdAt >= :from', { from })
      .andWhere('o.createdAt <= :to', { to })
      .select(
        'COALESCE(AVG(EXTRACT(EPOCH FROM (e.createdAt - o.createdAt))) / 60, 0)',
        'avgMinutes',
      )
      .getRawOne<{ avgMinutes: string }>();
    const averagePrepMinutes = Number(Number(prepRow?.avgMinutes ?? 0).toFixed(1));

    // Items per hour over the window (total items / window hours).
    const windowHours = Math.max(
      (to.getTime() - from.getTime()) / (1000 * 60 * 60),
      1,
    );
    const itemsRow = await this.itemRepo
      .createQueryBuilder('i')
      .innerJoin('i.order', 'o')
      .where('o.businessId = :bid', { bid: actor.businessId })
      .andWhere(storeId ? 'o.storeId = :sid' : '1=1', { sid: storeId })
      .andWhere('o.createdAt >= :from', { from })
      .andWhere('o.createdAt <= :to', { to })
      .andWhere('o.status NOT IN (:...excluded)', {
        excluded: [OrderStatus.CANCELLED],
      })
      .select('COALESCE(SUM(i.quantity), 0)', 'items')
      .getRawOne<{ items: string }>();
    const totalItems = Number(itemsRow?.items ?? 0);
    const itemsPerHour = Number((totalItems / windowHours).toFixed(1));

    // Busiest hour-of-day across the window.
    const busyRow = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.businessId = :bid', { bid: actor.businessId })
      .andWhere(storeId ? 'o.storeId = :sid' : '1=1', { sid: storeId })
      .andWhere('o.createdAt >= :from', { from })
      .andWhere('o.createdAt <= :to', { to })
      .andWhere('o.status NOT IN (:...excluded)', {
        excluded: [OrderStatus.CANCELLED],
      })
      .select('EXTRACT(HOUR FROM o.createdAt)', 'hour')
      .addSelect('COUNT(o.id)', 'count')
      .groupBy('hour')
      .orderBy('count', 'DESC')
      .limit(1)
      .getRawOne<{ hour: string; count: string }>();

    return {
      ordersServed,
      averagePrepMinutes,
      itemsPerHour,
      busiestHour: busyRow?.hour != null ? Number(busyRow.hour) : null,
      inflightCount: inflight,
    };
  }

  // ----- delivery -----

  async getDeliveryStats(
    actor: ActorContext,
    filter: ReportsRangeDto,
  ): Promise<DeliveryStatsDto> {
    const { from, to } = this.dateBound(filter);
    const storeId = this.effectiveStoreId(actor, filter.storeId);

    const qb = this.deliveryRepo
      .createQueryBuilder('d')
      .where('d.businessId = :bid', { bid: actor.businessId })
      .andWhere('d.createdAt >= :from', { from })
      .andWhere('d.createdAt <= :to', { to });
    if (storeId) qb.andWhere('d.storeId = :sid', { sid: storeId });

    const totalDeliveries = await qb.clone().getCount();
    const delivered = await qb
      .clone()
      .andWhere('d.status = :ds', { ds: DeliveryStatus.DELIVERED })
      .getCount();
    const failed = await qb
      .clone()
      .andWhere('d.status = :ds', { ds: DeliveryStatus.FAILED })
      .getCount();

    const successRate = totalDeliveries > 0 ? (delivered / totalDeliveries) * 100 : 0;

    const avgRow = await qb
      .clone()
      .andWhere('d.pickedUpAt IS NOT NULL AND d.deliveredAt IS NOT NULL')
      .select(
        'COALESCE(AVG(EXTRACT(EPOCH FROM (d.deliveredAt - d.pickedUpAt))) / 60, 0)',
        'avgMinutes',
      )
      .getRawOne<{ avgMinutes: string }>();

    const byRiderRows = await qb
      .clone()
      .andWhere('d.riderStaffId IS NOT NULL')
      .select('d.riderStaffId', 'riderStaffId')
      .addSelect('d.riderName', 'riderName')
      .addSelect(
        `SUM(CASE WHEN d.status = '${DeliveryStatus.DELIVERED}' THEN 1 ELSE 0 END)`,
        'delivered',
      )
      .addSelect(
        `SUM(CASE WHEN d.status = '${DeliveryStatus.FAILED}' THEN 1 ELSE 0 END)`,
        'failed',
      )
      .groupBy('d.riderStaffId')
      .addGroupBy('d.riderName')
      .getRawMany<{
        riderStaffId: string;
        riderName: string | null;
        delivered: string;
        failed: string;
      }>();

    return {
      totalDeliveries,
      delivered,
      failed,
      successRate: Number(successRate.toFixed(1)),
      averageDeliveryMinutes: Number(Number(avgRow?.avgMinutes ?? 0).toFixed(1)),
      byRider: byRiderRows.map((r) => ({
        riderStaffId: r.riderStaffId,
        riderName: r.riderName,
        delivered: Number(r.delivered),
        failed: Number(r.failed),
      })),
    };
  }

  // ----- dashboard summary -----

  async getDashboardSummary(
    actor: ActorContext,
    filter: DashboardSummaryFilterDto,
  ): Promise<DashboardSummaryDto> {
    const storeId = this.effectiveStoreId(actor, filter.storeId);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const orderTodayQb = this.orderRepo
      .createQueryBuilder('o')
      .where('o.businessId = :bid', { bid: actor.businessId })
      .andWhere('o.createdAt >= :today', { today: startOfToday })
      .andWhere('o.status NOT IN (:...excluded)', {
        excluded: [OrderStatus.CANCELLED],
      });
    if (storeId) orderTodayQb.andWhere('o.storeId = :sid', { sid: storeId });

    const todayOrders = await orderTodayQb.clone().getCount();
    const revenueRow = await orderTodayQb
      .clone()
      .select('COALESCE(SUM(o.total), 0)', 'sum')
      .getRawOne<{ sum: string }>();
    const todayRevenue = Number(revenueRow?.sum ?? 0);

    const openOrders = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.businessId = :bid', { bid: actor.businessId })
      .andWhere(storeId ? 'o.storeId = :sid' : '1=1', { sid: storeId })
      .andWhere('o.status IN (:...statuses)', {
        statuses: [OrderStatus.PENDING, OrderStatus.PREPARING, OrderStatus.READY],
      })
      .getCount();

    const activeShifts = await this.shiftRepo
      .createQueryBuilder('s')
      .where('s.status = :st', { st: ShiftStatus.IN_PROGRESS })
      .andWhere(storeId ? 's.storeId = :sid' : '1=1', { sid: storeId })
      .getCount();

    const lowStockCount = await this.ingredientRepo
      .createQueryBuilder('i')
      .where('i.currentStock <= i.minStock')
      .andWhere(storeId ? 'i.storeId = :sid' : '1=1', { sid: storeId })
      .getCount();

    const pendingExpenses = await this.expenseRepo
      .createQueryBuilder('e')
      .where('e.businessId = :bid', { bid: actor.businessId })
      .andWhere('e.status = :st', { st: ExpenseStatus.PENDING })
      .andWhere(storeId ? 'e.storeId = :sid' : '1=1', { sid: storeId })
      .getCount();

    const deliveriesInTransit = await this.deliveryRepo
      .createQueryBuilder('d')
      .where('d.businessId = :bid', { bid: actor.businessId })
      .andWhere(storeId ? 'd.storeId = :sid' : '1=1', { sid: storeId })
      .andWhere('d.status = :ds', { ds: DeliveryStatus.IN_TRANSIT })
      .getCount();

    // Yesterday revenue for the same hour-window today (now-24h..now-24h),
    // used by the dashboard to render an at-a-glance delta indicator.
    const yesterdayStart = new Date(startOfToday);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayQb = this.orderRepo
      .createQueryBuilder('o')
      .where('o.businessId = :bid', { bid: actor.businessId })
      .andWhere('o.createdAt >= :ys', { ys: yesterdayStart })
      .andWhere('o.createdAt < :today', { today: startOfToday })
      .andWhere('o.status NOT IN (:...excluded)', {
        excluded: [OrderStatus.CANCELLED],
      });
    if (storeId) yesterdayQb.andWhere('o.storeId = :sid', { sid: storeId });
    const yesterdayRevenueRow = await yesterdayQb
      .select('COALESCE(SUM(o.total), 0)', 'sum')
      .getRawOne<{ sum: string }>();
    const yesterdayRevenue = Number(yesterdayRevenueRow?.sum ?? 0);

    // Customer counts (business-wide; not store-scoped).
    const totalCustomers = await this.customerRepo
      .createQueryBuilder('c')
      .where('c.businessId = :bid', { bid: actor.businessId })
      .getCount();
    const newCustomersToday = await this.customerRepo
      .createQueryBuilder('c')
      .where('c.businessId = :bid', { bid: actor.businessId })
      .andWhere('c.createdAt >= :today', { today: startOfToday })
      .getCount();
    const loyaltyMembers = await this.customerRepo
      .createQueryBuilder('c')
      .where('c.businessId = :bid', { bid: actor.businessId })
      .andWhere('c.points > 0')
      .getCount();

    const openCashSessions = await this.cashSessionRepo
      .createQueryBuilder('cs')
      .where('cs.businessId = :bid', { bid: actor.businessId })
      .andWhere('cs.status = :st', { st: 'open' })
      .andWhere(storeId ? 'cs.storeId = :sid' : '1=1', { sid: storeId })
      .getCount();

    return {
      todayOrders,
      todayRevenue,
      yesterdayRevenue,
      openOrders,
      activeShifts,
      lowStockCount,
      pendingExpenses,
      deliveriesInTransit,
      newCustomersToday,
      totalCustomers,
      loyaltyMembers,
      openCashSessions,
    };
  }
}
