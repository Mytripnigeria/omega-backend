import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { OrderEntity, OrderStatus } from './entities/order.entity';
import { OrderItemEntity } from './entities/order-item.entity';
import { OrderStatusEventEntity } from './entities/order-status-event.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import {
  CancelOrderDto,
  OrderFilterDto,
  RecordPaymentDto,
  UpdateOrderStatusDto,
  UpdatePrepStatusDto,
} from './dto/order-filter.dto';
import {
  OrderItemResponseDto,
  OrderResponseDto,
} from './dto/order-response.dto';
import { PaginatedResponseDto, paginate } from '../../common/dto/pagination.dto';
import { ActivityLogService } from '../activity-log/activity-log.service';

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.CANCELLED],
  [OrderStatus.READY]: [OrderStatus.SERVED, OrderStatus.CANCELLED],
  [OrderStatus.SERVED]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
};

interface ActorContext {
  sub: string;
  sub_type: 'admin' | 'staff';
  businessId: string;
  storeId?: string;
  actorName?: string;
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    @InjectRepository(OrderItemEntity)
    private readonly itemRepo: Repository<OrderItemEntity>,
    @InjectRepository(OrderStatusEventEntity)
    private readonly eventRepo: Repository<OrderStatusEventEntity>,
    private readonly dataSource: DataSource,
    private readonly activityLog: ActivityLogService,
  ) {}

  /**
   * Allocates the next sequential order number for a store, atomically.
   * Uses Postgres advisory lock keyed by storeId hash to serialize concurrent
   * inserts within the same store while still allowing different stores to
   * write in parallel.
   */
  private async nextOrderNumber(
    manager: DataSource['manager'],
    storeId: string,
  ): Promise<number> {
    // Hash the storeId to a 32-bit int for pg_advisory_xact_lock(int).
    // This lock auto-releases at end of transaction.
    await manager.query("SELECT pg_advisory_xact_lock(hashtext($1))", [storeId]);
    const row = await manager
      .createQueryBuilder(OrderEntity, 'o')
      .withDeleted()
      .select('COALESCE(MAX(o.orderNumber), 0)', 'max')
      .where('o.storeId = :storeId', { storeId })
      .getRawOne<{ max: string }>();
    return (parseInt(row?.max ?? '0', 10) || 0) + 1;
  }

  async create(actor: ActorContext, dto: CreateOrderDto): Promise<OrderResponseDto> {
    if (!actor.storeId) {
      throw new BadRequestException('Order requires a store context');
    }

    const subtotal = dto.items.reduce(
      (sum, i) => sum + Number(i.unitPrice) * i.quantity,
      0,
    );
    const taxAmount = Number(dto.taxAmount ?? 0);
    const discountAmount = Number(dto.discountAmount ?? 0);
    const total = subtotal + taxAmount - discountAmount;

    const saved = await this.dataSource.transaction(async (manager) => {
      const orderNumber = await this.nextOrderNumber(manager, actor.storeId!);

      const order = manager.create(OrderEntity, {
        orderNumber,
        businessId: actor.businessId,
        storeId: actor.storeId!,
        staffId: actor.sub_type === 'staff' ? actor.sub : null,
        staffName: actor.actorName ?? null,
        customerName: dto.customerName ?? null,
        customerPhone: dto.customerPhone ?? null,
        tableNumber: dto.tableNumber ?? null,
        channel: dto.channel ?? 'pos',
        isDelivery: dto.isDelivery ?? false,
        status: OrderStatus.PENDING,
        subtotal,
        taxAmount,
        discountAmount,
        total,
        paidAmount: 0,
        notes: dto.notes ?? null,
        items: dto.items.map((i) =>
          manager.create(OrderItemEntity, {
            productId: i.productId ?? null,
            comboId: i.comboId ?? null,
            name: i.name,
            quantity: i.quantity,
            unitPrice: Number(i.unitPrice),
            subtotal: Number(i.unitPrice) * i.quantity,
            variation: i.variation ?? null,
            addons: i.addons ?? null,
            notes: i.notes ?? null,
            prepStatus: 'pending',
          }),
        ),
      });

      const persisted = await manager.save(order);

      await manager.save(
        manager.create(OrderStatusEventEntity, {
          orderId: persisted.id,
          fromStatus: null,
          toStatus: OrderStatus.PENDING,
          actorId: actor.sub,
          actorType: actor.sub_type,
        }),
      );

      return persisted;
    });

    this.activityLog.record({
      actorType: actor.sub_type,
      actorId: actor.sub,
      actorName: actor.actorName ?? 'Unknown',
      action: 'order.created',
      businessId: actor.businessId,
      storeId: actor.storeId,
      resourceType: 'order',
      resourceId: saved.id,
      metadata: { orderNumber: saved.orderNumber, total: Number(saved.total), itemCount: dto.items.length },
    });

    return this.findOne(actor, saved.id);
  }

  async findAll(
    actor: ActorContext,
    filter: OrderFilterDto,
  ): Promise<PaginatedResponseDto<OrderResponseDto>> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;

    const qb = this.orderRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.items', 'items')
      .where('o.businessId = :businessId', { businessId: actor.businessId })
      .orderBy('o.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (filter.storeId) qb.andWhere('o.storeId = :storeId', { storeId: filter.storeId });
    // Staff are scoped to their own store automatically.
    if (actor.sub_type === 'staff' && actor.storeId) {
      qb.andWhere('o.storeId = :scopedStore', { scopedStore: actor.storeId });
    }
    if (filter.staffId) qb.andWhere('o.staffId = :staffId', { staffId: filter.staffId });
    if (filter.channel) qb.andWhere('o.channel = :channel', { channel: filter.channel });

    if (filter.status) {
      const statuses = filter.status.split(',').map((s) => s.trim()).filter(Boolean);
      if (statuses.length) qb.andWhere('o.status IN (:...statuses)', { statuses });
    }

    if (filter.search) {
      qb.andWhere(
        '(CAST(o.orderNumber AS TEXT) ILIKE :search OR o.customerName ILIKE :search OR o.customerPhone ILIKE :search OR o.tableNumber ILIKE :search)',
        { search: `%${filter.search}%` },
      );
    }

    if (filter.dateFrom) qb.andWhere('o.createdAt >= :df', { df: filter.dateFrom });
    if (filter.dateTo) qb.andWhere('o.createdAt <= :dt', { dt: `${filter.dateTo} 23:59:59` });

    const [data, total] = await qb.getManyAndCount();
    return paginate(data, total, page, limit, OrderResponseDto.from);
  }

  async findOne(actor: ActorContext, id: string): Promise<OrderResponseDto> {
    return OrderResponseDto.from(await this.findEntity(actor, id));
  }

  private async findEntity(actor: ActorContext, id: string): Promise<OrderEntity> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['items'],
    });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    if (order.businessId !== actor.businessId) {
      throw new ForbiddenException('Order belongs to another business');
    }
    if (actor.sub_type === 'staff' && actor.storeId && order.storeId !== actor.storeId) {
      throw new ForbiddenException('Order belongs to another store');
    }
    return order;
  }

  async getStats(actor: ActorContext, storeId?: string) {
    const qb = this.orderRepo
      .createQueryBuilder('o')
      .where('o.businessId = :businessId', { businessId: actor.businessId });
    if (storeId) qb.andWhere('o.storeId = :storeId', { storeId });
    if (actor.sub_type === 'staff' && actor.storeId) {
      qb.andWhere('o.storeId = :scopedStore', { scopedStore: actor.storeId });
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todayQb = qb.clone().andWhere('o.createdAt >= :today', { today: startOfToday });

    const [todayCount, todayRevenueRow, pendingCount, preparingCount, readyCount] = await Promise.all([
      todayQb.clone().getCount(),
      todayQb
        .clone()
        .select('COALESCE(SUM(o.total), 0)', 'total')
        .getRawOne<{ total: string }>(),
      qb.clone().andWhere('o.status = :s', { s: OrderStatus.PENDING }).getCount(),
      qb.clone().andWhere('o.status = :s', { s: OrderStatus.PREPARING }).getCount(),
      qb.clone().andWhere('o.status = :s', { s: OrderStatus.READY }).getCount(),
    ]);

    return {
      todayCount,
      todayRevenue: Number(todayRevenueRow?.total ?? 0),
      pendingCount,
      preparingCount,
      readyCount,
    };
  }

  async updateStatus(
    actor: ActorContext,
    id: string,
    dto: UpdateOrderStatusDto,
  ): Promise<OrderResponseDto> {
    const order = await this.findEntity(actor, id);
    const allowed = VALID_TRANSITIONS[order.status];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition from ${order.status} to ${dto.status}`,
      );
    }

    const fromStatus = order.status;
    order.status = dto.status;

    await this.dataSource.transaction(async (m) => {
      await m.save(order);
      await m.save(
        m.create(OrderStatusEventEntity, {
          orderId: order.id,
          fromStatus,
          toStatus: dto.status,
          actorId: actor.sub,
          actorType: actor.sub_type,
        }),
      );
    });

    this.activityLog.record({
      actorType: actor.sub_type,
      actorId: actor.sub,
      actorName: actor.actorName ?? 'Unknown',
      action: `order.${dto.status}`,
      businessId: actor.businessId,
      storeId: order.storeId,
      resourceType: 'order',
      resourceId: order.id,
      metadata: { orderNumber: order.orderNumber, from: fromStatus, to: dto.status },
    });

    return this.findOne(actor, order.id);
  }

  async cancel(
    actor: ActorContext,
    id: string,
    dto: CancelOrderDto,
  ): Promise<OrderResponseDto> {
    const order = await this.findEntity(actor, id);
    if (order.status === OrderStatus.COMPLETED || order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException(`Cannot cancel a ${order.status} order`);
    }

    const fromStatus = order.status;
    order.status = OrderStatus.CANCELLED;

    await this.dataSource.transaction(async (m) => {
      await m.save(order);
      await m.save(
        m.create(OrderStatusEventEntity, {
          orderId: order.id,
          fromStatus,
          toStatus: OrderStatus.CANCELLED,
          actorId: actor.sub,
          actorType: actor.sub_type,
          reason: dto.reason ?? null,
        }),
      );
    });

    this.activityLog.record({
      actorType: actor.sub_type,
      actorId: actor.sub,
      actorName: actor.actorName ?? 'Unknown',
      action: 'order.cancelled',
      businessId: actor.businessId,
      storeId: order.storeId,
      resourceType: 'order',
      resourceId: order.id,
      metadata: { orderNumber: order.orderNumber, reason: dto.reason ?? null },
    });

    return this.findOne(actor, order.id);
  }

  async recordPayment(
    actor: ActorContext,
    id: string,
    dto: RecordPaymentDto,
  ): Promise<OrderResponseDto> {
    const order = await this.findEntity(actor, id);
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot record payment on a cancelled order');
    }

    const amount = Number(dto.amount ?? Number(order.total) - Number(order.paidAmount));
    if (amount <= 0) throw new BadRequestException('Payment amount must be positive');

    order.paidAmount = Number(order.paidAmount) + amount;
    if (dto.paymentMethodId) order.paymentMethodId = dto.paymentMethodId;
    if (Number(order.paidAmount) >= Number(order.total)) {
      order.paidAt = new Date();
      // Auto-transition to completed if it was already served, otherwise leave status alone.
      if (order.status === OrderStatus.SERVED) {
        order.status = OrderStatus.COMPLETED;
      }
    }
    await this.orderRepo.save(order);

    this.activityLog.record({
      actorType: actor.sub_type,
      actorId: actor.sub,
      actorName: actor.actorName ?? 'Unknown',
      action: 'order.payment_recorded',
      businessId: actor.businessId,
      storeId: order.storeId,
      resourceType: 'order',
      resourceId: order.id,
      metadata: {
        orderNumber: order.orderNumber,
        amount,
        paidAmount: Number(order.paidAmount),
        paymentMethodId: dto.paymentMethodId ?? null,
      },
    });

    return this.findOne(actor, order.id);
  }

  async updateItemPrepStatus(
    actor: ActorContext,
    orderId: string,
    itemId: string,
    dto: UpdatePrepStatusDto,
  ): Promise<OrderItemResponseDto> {
    const order = await this.findEntity(actor, orderId);
    const item = order.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException(`Item ${itemId} not found in order ${orderId}`);

    item.prepStatus = dto.prepStatus;
    await this.itemRepo.save(item);

    // Auto-transition order status based on aggregate item prep states.
    const reloaded = await this.findEntity(actor, orderId);
    const allReady = reloaded.items.every((i) => i.prepStatus === 'ready');
    const anyPreparing = reloaded.items.some((i) => i.prepStatus === 'preparing');

    if (allReady && reloaded.status === OrderStatus.PREPARING) {
      reloaded.status = OrderStatus.READY;
      await this.orderRepo.save(reloaded);
      await this.eventRepo.save(
        this.eventRepo.create({
          orderId: reloaded.id,
          fromStatus: OrderStatus.PREPARING,
          toStatus: OrderStatus.READY,
          actorId: actor.sub,
          actorType: actor.sub_type,
        }),
      );
    } else if (anyPreparing && reloaded.status === OrderStatus.PENDING) {
      reloaded.status = OrderStatus.PREPARING;
      await this.orderRepo.save(reloaded);
      await this.eventRepo.save(
        this.eventRepo.create({
          orderId: reloaded.id,
          fromStatus: OrderStatus.PENDING,
          toStatus: OrderStatus.PREPARING,
          actorId: actor.sub,
          actorType: actor.sub_type,
        }),
      );
    }

    this.activityLog.record({
      actorType: actor.sub_type,
      actorId: actor.sub,
      actorName: actor.actorName ?? 'Unknown',
      action: 'order.item_prep_updated',
      businessId: actor.businessId,
      storeId: order.storeId,
      resourceType: 'order',
      resourceId: order.id,
      metadata: { orderNumber: order.orderNumber, itemId, itemName: item.name, prepStatus: dto.prepStatus },
    });

    return OrderItemResponseDto.from(item);
  }
}
