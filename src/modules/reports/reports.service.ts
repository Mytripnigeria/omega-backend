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
import {
  ReportsRangeDto,
  SalesReportFilterDto,
  DashboardSummaryFilterDto,
} from './dto/reports-filter.dto';
import {
  DashboardSummaryDto,
  DeliveryStatsDto,
  KitchenStatsDto,
  SalesReportDto,
  StaffPerformanceDto,
  StaffPerformanceRowDto,
  SalesReportBucketDto,
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
      groupBy === 'month' ? 'month' : groupBy === 'week' ? 'week' : 'day';

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

    return {
      todayOrders,
      todayRevenue,
      openOrders,
      activeShifts,
      lowStockCount,
      pendingExpenses,
      deliveriesInTransit,
    };
  }
}
