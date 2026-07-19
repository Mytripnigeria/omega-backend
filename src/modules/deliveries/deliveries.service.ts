import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeliveryEntity, DeliveryStatus } from './entities/delivery.entity';
import { OrderEntity, OrderStatus } from '../orders/entities/order.entity';
import { StaffEntity } from '../staff/entities/staff.entity';
import {
  AssignDeliveryDto,
  CreateDeliveryDto,
  DeliveryFilterDto,
  FailDeliveryDto,
} from './dto/delivery-dto';
import { DeliveryResponseDto } from './dto/delivery-response.dto';
import { PaginatedResponseDto, paginate } from '../../common/dto/pagination.dto';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { OrdersService } from '../orders/orders.service';

interface ActorContext {
  sub: string;
  sub_type: 'admin' | 'staff';
  businessId: string;
  storeId?: string;
  actorName?: string;
}

const VALID_TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  // The waiter's "Send for delivery" dispatches an awaiting delivery onto the
  // rider board (-> PENDING).
  [DeliveryStatus.AWAITING_DISPATCH]: [
    DeliveryStatus.PENDING,
    DeliveryStatus.FAILED,
  ],
  [DeliveryStatus.PENDING]: [DeliveryStatus.ASSIGNED, DeliveryStatus.FAILED],
  [DeliveryStatus.ASSIGNED]: [DeliveryStatus.IN_TRANSIT, DeliveryStatus.FAILED],
  [DeliveryStatus.IN_TRANSIT]: [DeliveryStatus.DELIVERED, DeliveryStatus.FAILED],
  [DeliveryStatus.DELIVERED]: [],
  [DeliveryStatus.FAILED]: [],
};

@Injectable()
export class DeliveriesService {
  constructor(
    @InjectRepository(DeliveryEntity)
    private readonly repo: Repository<DeliveryEntity>,
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    @InjectRepository(StaffEntity)
    private readonly staffRepo: Repository<StaffEntity>,
    private readonly activityLog: ActivityLogService,
    private readonly ordersService: OrdersService,
  ) {}

  async create(actor: ActorContext, dto: CreateDeliveryDto): Promise<DeliveryResponseDto> {
    const order = await this.orderRepo.findOne({ where: { id: dto.orderId } });
    if (!order) throw new NotFoundException(`Order ${dto.orderId} not found`);
    if (order.businessId !== actor.businessId) {
      throw new ForbiddenException('Order belongs to another business');
    }

    const existing = await this.repo.findOne({ where: { orderId: dto.orderId } });
    if (existing) {
      throw new BadRequestException('Delivery already exists for this order');
    }

    const delivery = this.repo.create({
      orderId: order.id,
      businessId: order.businessId,
      storeId: order.storeId,
      address: dto.address,
      phone: dto.phone ?? order.customerPhone ?? null,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      notes: dto.notes ?? null,
      status: DeliveryStatus.PENDING,
    });
    const saved = await this.repo.save(delivery);

    // Mark the order as delivery so it routes correctly downstream.
    if (!order.isDelivery) {
      order.isDelivery = true;
      await this.orderRepo.save(order);
    }

    this.activityLog.record({
      actorType: actor.sub_type,
      actorId: actor.sub,
      actorName: actor.actorName ?? 'Unknown',
      action: 'delivery.created',
      businessId: actor.businessId,
      storeId: order.storeId,
      resourceType: 'delivery',
      resourceId: saved.id,
      metadata: { orderNumber: order.orderNumber, address: dto.address },
    });

    return this.findOne(actor, saved.id);
  }

  async findAll(
    actor: ActorContext,
    filter: DeliveryFilterDto,
  ): Promise<PaginatedResponseDto<DeliveryResponseDto>> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;

    const qb = this.repo
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.order', 'order')
      .leftJoinAndSelect('order.items', 'orderItems')
      .where('d.businessId = :businessId', { businessId: actor.businessId })
      .orderBy('d.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (filter.storeId) qb.andWhere('d.storeId = :storeId', { storeId: filter.storeId });
    if (actor.sub_type === 'staff' && actor.storeId) {
      qb.andWhere('d.storeId = :scopedStore', { scopedStore: actor.storeId });
    }
    if (filter.riderStaffId) qb.andWhere('d.riderStaffId = :rid', { rid: filter.riderStaffId });

    if (filter.status) {
      const statuses = filter.status.split(',').map((s) => s.trim()).filter(Boolean);
      if (statuses.length) qb.andWhere('d.status IN (:...statuses)', { statuses });
    }

    if (filter.dateFrom) qb.andWhere('d.createdAt >= :df', { df: filter.dateFrom });
    if (filter.dateTo) qb.andWhere('d.createdAt <= :dt', { dt: `${filter.dateTo} 23:59:59` });

    const [data, total] = await qb.getManyAndCount();
    return paginate(data, total, page, limit, DeliveryResponseDto.from);
  }

  async findMy(
    actor: ActorContext,
    filter: DeliveryFilterDto,
  ): Promise<PaginatedResponseDto<DeliveryResponseDto>> {
    if (actor.sub_type !== 'staff') {
      throw new ForbiddenException('Only staff can list their own deliveries');
    }
    return this.findAll(actor, { ...filter, riderStaffId: actor.sub });
  }

  async findOne(actor: ActorContext, id: string): Promise<DeliveryResponseDto> {
    return DeliveryResponseDto.from(await this.findEntity(actor, id));
  }

  private async findEntity(actor: ActorContext, id: string): Promise<DeliveryEntity> {
    const delivery = await this.repo.findOne({
      where: { id },
      relations: ['order', 'order.items'],
    });
    if (!delivery) throw new NotFoundException(`Delivery ${id} not found`);
    if (delivery.businessId !== actor.businessId) {
      throw new ForbiddenException('Delivery belongs to another business');
    }
    if (
      actor.sub_type === 'staff' &&
      actor.storeId &&
      delivery.storeId !== actor.storeId
    ) {
      throw new ForbiddenException('Delivery belongs to another store');
    }
    return delivery;
  }

  private assertTransition(from: DeliveryStatus, to: DeliveryStatus): void {
    if (!VALID_TRANSITIONS[from].includes(to)) {
      throw new BadRequestException(`Cannot transition delivery from ${from} to ${to}`);
    }
  }

  /**
   * Waiter hand-off: "Send for delivery" moves an awaiting delivery onto the
   * rider board (AWAITING_DISPATCH -> PENDING). Riders only ever see PENDING
   * onwards, so nothing is offered for acceptance before the waiter sends it.
   */
  async dispatch(actor: ActorContext, id: string): Promise<DeliveryResponseDto> {
    const delivery = await this.findEntity(actor, id);
    this.assertTransition(delivery.status, DeliveryStatus.PENDING);

    delivery.status = DeliveryStatus.PENDING;
    delivery.dispatchedAt = new Date();
    delivery.dispatchedByStaffId = actor.sub_type === 'staff' ? actor.sub : null;
    delivery.dispatchedByName = actor.actorName ?? null;
    await this.repo.save(delivery);

    this.activityLog.record({
      actorType: actor.sub_type,
      actorId: actor.sub,
      actorName: actor.actorName ?? 'Unknown',
      action: 'delivery.dispatched',
      businessId: actor.businessId,
      storeId: delivery.storeId,
      resourceType: 'delivery',
      resourceId: delivery.id,
      metadata: { orderId: delivery.orderId },
    });

    return this.findOne(actor, delivery.id);
  }

  async assign(
    actor: ActorContext,
    id: string,
    dto: AssignDeliveryDto,
  ): Promise<DeliveryResponseDto> {
    const delivery = await this.findEntity(actor, id);
    this.assertTransition(delivery.status, DeliveryStatus.ASSIGNED);

    const rider = await this.staffRepo.findOne({ where: { id: dto.riderStaffId } });
    if (!rider) throw new NotFoundException(`Rider ${dto.riderStaffId} not found`);
    if (rider.storeId !== delivery.storeId) {
      throw new BadRequestException('Rider does not belong to this store');
    }

    delivery.riderStaffId = rider.id;
    delivery.riderName = `${rider.firstName} ${rider.lastName}`;
    delivery.status = DeliveryStatus.ASSIGNED;
    delivery.assignedAt = new Date();
    await this.repo.save(delivery);

    this.activityLog.record({
      actorType: actor.sub_type,
      actorId: actor.sub,
      actorName: actor.actorName ?? 'Unknown',
      action: 'delivery.assigned',
      businessId: actor.businessId,
      storeId: delivery.storeId,
      resourceType: 'delivery',
      resourceId: delivery.id,
      metadata: { riderStaffId: rider.id, riderName: delivery.riderName },
    });

    return this.findOne(actor, delivery.id);
  }

  async pickup(actor: ActorContext, id: string): Promise<DeliveryResponseDto> {
    const delivery = await this.findEntity(actor, id);
    if (actor.sub_type === 'staff' && delivery.riderStaffId !== actor.sub) {
      throw new ForbiddenException('You can only pick up your own deliveries');
    }
    this.assertTransition(delivery.status, DeliveryStatus.IN_TRANSIT);
    delivery.status = DeliveryStatus.IN_TRANSIT;
    delivery.pickedUpAt = new Date();
    await this.repo.save(delivery);

    // The order is now out for delivery. Routed through OrdersService so the
    // status event, customer push and any pending side-effects all fire (the
    // rider gate passes — riderStaffId was set at accept).
    const pickedOrder = await this.orderRepo.findOne({
      where: { id: delivery.orderId },
    });
    if (
      pickedOrder &&
      (pickedOrder.status === OrderStatus.READY ||
        pickedOrder.status === OrderStatus.PREPARING)
    ) {
      // PREPARING can't transition straight to DELIVERING — step through
      // READY first for late pickups on orders still marked as in prep.
      if (pickedOrder.status === OrderStatus.PREPARING) {
        await this.ordersService.updateStatus(actor, pickedOrder.id, {
          status: OrderStatus.READY,
        });
      }
      await this.ordersService.updateStatus(actor, pickedOrder.id, {
        status: OrderStatus.DELIVERING,
      });
    }

    this.activityLog.record({
      actorType: actor.sub_type,
      actorId: actor.sub,
      actorName: actor.actorName ?? 'Unknown',
      action: 'delivery.picked_up',
      businessId: actor.businessId,
      storeId: delivery.storeId,
      resourceType: 'delivery',
      resourceId: delivery.id,
    });

    return this.findOne(actor, delivery.id);
  }

  async deliver(actor: ActorContext, id: string): Promise<DeliveryResponseDto> {
    const delivery = await this.findEntity(actor, id);
    if (actor.sub_type === 'staff' && delivery.riderStaffId !== actor.sub) {
      throw new ForbiddenException('You can only deliver your own deliveries');
    }
    this.assertTransition(delivery.status, DeliveryStatus.DELIVERED);
    delivery.status = DeliveryStatus.DELIVERED;
    delivery.deliveredAt = new Date();
    await this.repo.save(delivery);

    // Completing the delivery completes the order (delivering -> completed).
    // Routed through OrdersService so cash-on-delivery settles onto the
    // ledger, ingredients deduct if they somehow haven't, and the status
    // event + customer push fire.
    const order = await this.orderRepo.findOne({ where: { id: delivery.orderId } });
    if (
      order &&
      order.status !== OrderStatus.COMPLETED &&
      order.status !== OrderStatus.CANCELLED
    ) {
      // Step any earlier status up to DELIVERING first so the transition
      // matrix is honoured (e.g. a deliver recorded before pickup synced).
      if (order.status === OrderStatus.PREPARING) {
        await this.ordersService.updateStatus(actor, order.id, {
          status: OrderStatus.READY,
        });
        order.status = OrderStatus.READY;
      }
      if (order.status === OrderStatus.READY) {
        await this.ordersService.updateStatus(actor, order.id, {
          status: OrderStatus.DELIVERING,
        });
        order.status = OrderStatus.DELIVERING;
      }
      await this.ordersService.updateStatus(actor, order.id, {
        status: OrderStatus.COMPLETED,
      });
    }

    this.activityLog.record({
      actorType: actor.sub_type,
      actorId: actor.sub,
      actorName: actor.actorName ?? 'Unknown',
      action: 'delivery.delivered',
      businessId: actor.businessId,
      storeId: delivery.storeId,
      resourceType: 'delivery',
      resourceId: delivery.id,
    });

    return this.findOne(actor, delivery.id);
  }

  async fail(
    actor: ActorContext,
    id: string,
    dto: FailDeliveryDto,
  ): Promise<DeliveryResponseDto> {
    const delivery = await this.findEntity(actor, id);
    if (
      delivery.status === DeliveryStatus.DELIVERED ||
      delivery.status === DeliveryStatus.FAILED
    ) {
      throw new BadRequestException(`Cannot fail a ${delivery.status} delivery`);
    }
    delivery.status = DeliveryStatus.FAILED;
    delivery.failureReason = dto.reason;
    await this.repo.save(delivery);

    this.activityLog.record({
      actorType: actor.sub_type,
      actorId: actor.sub,
      actorName: actor.actorName ?? 'Unknown',
      action: 'delivery.failed',
      businessId: actor.businessId,
      storeId: delivery.storeId,
      resourceType: 'delivery',
      resourceId: delivery.id,
      metadata: { reason: dto.reason },
    });

    return this.findOne(actor, delivery.id);
  }
}
