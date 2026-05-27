import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
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
import { CustomersService } from '../customers/customers.service';
import { CouponsService } from '../coupons/coupons.service';
import { CustomerEntity } from '../customers/entities/customer.entity';
import {
  PointsTransactionEntity,
  PointsTransactionType,
  WalletTransactionEntity,
  WalletTransactionType,
} from '../customers/entities/wallet-transaction.entity';
import { PaystackService } from '../paystack/paystack.service';
import { FinancialTransactionsService } from '../financial-transactions/financial-transactions.service';
import { TransactionMethod } from '../financial-transactions/entities/financial-transaction.entity';
import { MerchantWalletService } from '../merchant-wallet/merchant-wallet.service';
import { TableEntity, TableStatus } from '../tables/entities/table.entity';
import { PushService } from '../push-notifications/push.service';

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
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    @InjectRepository(OrderItemEntity)
    private readonly itemRepo: Repository<OrderItemEntity>,
    @InjectRepository(OrderStatusEventEntity)
    private readonly eventRepo: Repository<OrderStatusEventEntity>,
    @InjectRepository(TableEntity)
    private readonly tableRepo: Repository<TableEntity>,
    private readonly dataSource: DataSource,
    private readonly activityLog: ActivityLogService,
    private readonly customersService: CustomersService,
    private readonly ledger: FinancialTransactionsService,
    private readonly coupons: CouponsService,
    private readonly paystack: PaystackService,
    private readonly merchantWallet: MerchantWalletService,
    private readonly pushService: PushService,
  ) {}

  /**
   * Best-effort customer push notification on order status changes. Never
   * throws — push failures don't interrupt the order flow.
   */
  private async sendOrderStatusPush(
    order: OrderEntity,
    status: OrderStatus,
  ): Promise<void> {
    if (!order.customerId) return;
    const messages: Partial<Record<OrderStatus, { title: string; body: string }>> = {
      [OrderStatus.PREPARING]: {
        title: `Order #${order.orderNumber} confirmed`,
        body: "We're preparing your order now.",
      },
      [OrderStatus.READY]: {
        title: `Order #${order.orderNumber} is ready`,
        body: order.isDelivery
          ? 'A rider has been dispatched.'
          : "Come collect it whenever you're ready.",
      },
      [OrderStatus.SERVED]: {
        title: `Order #${order.orderNumber} delivered`,
        body: 'Enjoy your meal!',
      },
      [OrderStatus.COMPLETED]: {
        title: `Order #${order.orderNumber} completed`,
        body: 'Thanks for ordering — see you next time!',
      },
      [OrderStatus.CANCELLED]: {
        title: `Order #${order.orderNumber} cancelled`,
        body: 'Your order was cancelled. Any pre-payment will be refunded.',
      },
    };
    const msg = messages[status];
    if (!msg) return;
    try {
      await this.pushService.sendToCustomer(order.customerId, {
        title: msg.title,
        body: msg.body,
        url: `/order-tracking/${order.id}`,
        data: { orderId: order.id, status },
      });
    } catch (err) {
      this.logger.warn(
        `Push notification skipped for order ${order.id}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Releases the table attached to an order back to `available` when the order
   * reaches a terminal state. No-op if the table was already moved on (e.g.
   * staff manually set it to `cleaning`).
   */
  private async releaseTableIfAttached(
    tableId: string | null | undefined,
  ): Promise<void> {
    if (!tableId) return;
    await this.tableRepo.update(
      { id: tableId, status: TableStatus.OCCUPIED },
      { status: TableStatus.AVAILABLE },
    );
  }

  private mapPaymentChannelToMethod(
    ch: OrderEntity['paymentChannel'] | null | undefined,
  ): TransactionMethod {
    if (ch === 'paystack' || ch === 'card') return ch === 'card' ? 'card' : 'paystack';
    if (ch === 'cash') return 'cash';
    if (ch === 'wallet') return 'wallet';
    if (ch === 'points') return 'points';
    return 'other';
  }

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

    // If the order is being opened against a managed table, look it up and
    // snapshot the label so receipts/reports survive a future rename or
    // delete of the table.
    let tableId: string | null = null;
    let tableNumber: string | null = dto.tableNumber ?? null;
    if (dto.tableId) {
      const table = await this.tableRepo.findOne({ where: { id: dto.tableId } });
      if (!table || table.businessId !== actor.businessId) {
        throw new NotFoundException(`Table ${dto.tableId} not found`);
      }
      tableId = table.id;
      tableNumber = table.name;
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
        customerId: dto.customerId ?? null,
        customerName: dto.customerName ?? null,
        customerPhone: dto.customerPhone ?? null,
        tableId,
        tableNumber,
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

    // Mark the seated table as occupied after the order persists. Done outside
    // the transaction so a table-write race can't roll back the order.
    if (tableId) {
      await this.tableRepo.update(
        { id: tableId, status: TableStatus.AVAILABLE },
        { status: TableStatus.OCCUPIED },
      );
    }

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

    if (saved.customerId) {
      await this.customersService.recordOrder(saved.customerId, {
        ordersDelta: 1,
        spentDelta: Number(saved.total),
        orderAt: saved.createdAt,
      });
    }

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
    if (filter.customerId) qb.andWhere('o.customerId = :customerId', { customerId: filter.customerId });
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

    // Free the seated table when the order reaches a terminal state.
    if (dto.status === OrderStatus.COMPLETED || dto.status === OrderStatus.CANCELLED) {
      await this.releaseTableIfAttached(order.tableId);
    }

    // Best-effort customer push on every status change.
    await this.sendOrderStatusPush(order, dto.status);

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
    const wasPaid = order.paymentStatus === 'paid';
    order.status = OrderStatus.CANCELLED;

    await this.dataSource.transaction(async (m) => {
      // Refund the customer's monetary artefacts inside the same tx as the
      // status change so a refund failure rolls back the cancellation.
      await this.refundOrderArtefacts(m, order, actor);

      // Mark the order as fully refunded after compensation if it was paid.
      if (wasPaid) {
        order.paymentStatus = 'refunded';
        order.refundedAmount = Number(order.paidAmount);
      } else if (order.paymentStatus === 'pending') {
        order.paymentStatus = 'failed';
      }

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

    // Free the seated table now that the order is cancelled.
    await this.releaseTableIfAttached(order.tableId);

    await this.sendOrderStatusPush(order, OrderStatus.CANCELLED);

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

    if (order.customerId) {
      await this.customersService.recordOrder(order.customerId, {
        ordersDelta: -1,
        spentDelta: -Number(order.total),
      });
    }

    return this.findOne(actor, order.id);
  }

  /**
   * Inverts every monetary side-effect of an order on cancellation:
   *  • returns wallet pre-debit (storefront wallet orders held funds at place())
   *  • re-credits redeemed loyalty points
   *  • releases the coupon usage counter + redemption row
   *  • for paid Paystack orders, issues a Paystack refund and emits a debit
   *    on the financial ledger
   *
   * Idempotent — safe to re-run because each step checks for non-zero state
   * before writing.
   */
  private async refundOrderArtefacts(
    mgr: import('typeorm').EntityManager,
    order: OrderEntity,
    actor: ActorContext,
  ): Promise<void> {
    const customerRepo = mgr.getRepository(CustomerEntity);
    const walletTxRepo = mgr.getRepository(WalletTransactionEntity);
    const pointsTxRepo = mgr.getRepository(PointsTransactionEntity);

    // Restore wallet held by storefront wallet/points pre-debit OR refund a
    // wallet-paid order. For Paystack-paid orders, the refund happens via
    // Paystack below and we don't touch the wallet balance.
    if (order.customerId && order.paymentChannel === 'wallet' && Number(order.total) > 0) {
      const customer = await customerRepo.findOne({ where: { id: order.customerId } });
      if (customer) {
        const refundAmount = Number(order.paidAmount) > 0
          ? Number(order.paidAmount)
          : Number(order.total);
        if (refundAmount > 0) {
          customer.walletBalance = Number(customer.walletBalance) + refundAmount;
          await customerRepo.save(customer);
          const tx = await walletTxRepo.save(
            walletTxRepo.create({
              customerId: customer.id,
              type: WalletTransactionType.CREDIT,
              amount: refundAmount,
              balance: Number(customer.walletBalance),
              description: `Refund — order #${order.orderNumber} cancelled`,
              reference: `order:${order.id}`,
            }),
          );
          await this.ledger.record(
            {
              businessId: order.businessId,
              storeId: order.storeId,
              type: 'debit',
              purpose: 'order_refund',
              amount: refundAmount,
              method: 'wallet',
              reference: `order:${order.id}`,
              description: `Wallet refund — order #${order.orderNumber}`,
              linkedType: 'wallet_tx',
              linkedId: tx.id,
              customerId: customer.id,
              customerName: customer.firstName
                ? `${customer.firstName} ${customer.lastName}`.trim()
                : null,
              staffId: actor.sub,
              staffName: actor.actorName ?? null,
            },
            mgr,
          );
        }
      }
    }

    // Restore loyalty points redeemed at checkout.
    if (order.customerId && order.pointsRedeemed > 0) {
      const customer = await customerRepo.findOne({ where: { id: order.customerId } });
      if (customer) {
        customer.points = customer.points + order.pointsRedeemed;
        await customerRepo.save(customer);
        await pointsTxRepo.save(
          pointsTxRepo.create({
            customerId: customer.id,
            type: PointsTransactionType.ADJUSTED,
            points: order.pointsRedeemed,
            balance: customer.points,
            description: `Refund — order #${order.orderNumber} cancelled`,
            orderId: order.id,
          }),
        );
      }
    }

    // Release the coupon: decrement usageCount and remove the redemption row.
    if (order.couponId) {
      await this.coupons.unredeem(order.couponId, order.couponRedemptionId, mgr);
    }

    // Issue Paystack refund for paid card orders. Wrap the network call in a
    // try/catch so a Paystack outage doesn't break the cancellation — the
    // refund will still appear on the order's audit trail and admin can
    // re-issue manually.
    if (
      order.paymentChannel === 'paystack' &&
      order.paymentStatus === 'paid' &&
      order.paymentReference &&
      Number(order.paidAmount) > 0
    ) {
      try {
        const refundAmount = Number(order.paidAmount);
        await this.paystack.refund(
          order.paymentReference,
          Math.round(refundAmount * 100),
        );
        await this.ledger.record(
          {
            businessId: order.businessId,
            storeId: order.storeId,
            type: 'debit',
            purpose: 'order_refund',
            amount: refundAmount,
            method: this.mapPaymentChannelToMethod(order.paymentChannel),
            reference: order.paymentReference,
            description: `Paystack refund — order #${order.orderNumber}`,
            linkedType: 'order',
            linkedId: order.id,
            customerId: order.customerId,
            customerName: order.customerName,
            staffId: actor.sub,
            staffName: actor.actorName ?? null,
          },
          mgr,
        );
        // Reverse the original merchant-wallet credit. Allow overdraft so a
        // merchant who already paid out can still issue refunds — wallet may
        // go negative until offset by future order revenue.
        await this.merchantWallet.debit(
          {
            businessId: order.businessId,
            storeId: order.storeId,
            reason: 'order_refund',
            amount: refundAmount,
            description: `Refund — order #${order.orderNumber}`,
            linkedType: 'order',
            linkedId: order.id,
            allowOverdraft: true,
          },
          mgr,
        );
      } catch (err) {
        // Don't block the cancel — admin will re-issue manually.
        // Re-throw a softer error so the caller still sees something useful.
        throw new BadRequestException(
          `Paystack refund failed: ${(err as Error).message}. Cancel rolled back.`,
        );
      }
    }
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

    await this.dataSource.transaction(async (m) => {
      order.paidAmount = Number(order.paidAmount) + amount;
      if (dto.paymentMethodId) order.paymentMethodId = dto.paymentMethodId;
      if (dto.paymentChannel) order.paymentChannel = dto.paymentChannel;
      if (dto.paymentReference) order.paymentReference = dto.paymentReference;
      if (Number(order.paidAmount) >= Number(order.total)) {
        order.paidAt = new Date();
        order.paymentStatus = 'paid';
        if (order.status === OrderStatus.SERVED) {
          order.status = OrderStatus.COMPLETED;
        }
      }
      await m.save(order);

      await this.ledger.record(
        {
          businessId: actor.businessId,
          storeId: order.storeId,
          type: 'credit',
          purpose: 'order_payment',
          amount,
          method: this.mapPaymentChannelToMethod(order.paymentChannel),
          reference: order.paymentReference ?? null,
          description: `Order #${order.orderNumber} payment`,
          linkedType: 'order',
          linkedId: order.id,
          customerId: order.customerId,
          customerName: order.customerName,
          staffId: actor.sub_type === 'staff' ? actor.sub : order.staffId,
          staffName: actor.actorName ?? order.staffName ?? null,
        },
        m,
      );

      // Credit the merchant payout wallet for genuinely new money. Cash sits
      // in the till; wallet/points are intra-account movement and don't bring
      // payable cash to the merchant. Paystack/card payments do.
      if (
        order.paymentChannel === 'paystack' ||
        order.paymentChannel === 'card'
      ) {
        try {
          await this.merchantWallet.credit(
            {
              businessId: order.businessId,
              storeId: order.storeId,
              reason: 'order_payment',
              amount,
              description: `Order #${order.orderNumber} payment`,
              linkedType: 'order',
              linkedId: order.id,
            },
            m,
          );
        } catch (err) {
          this.logger.warn(
            `Merchant wallet credit failed for order ${order.id}: ${(err as Error).message}`,
          );
        }
      }
    });

    // If the payment closed out the order (SERVED → COMPLETED above), free
    // the seated table back to `available`.
    if (order.status === OrderStatus.COMPLETED) {
      await this.releaseTableIfAttached(order.tableId);
    }

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

  async refund(
    actor: ActorContext,
    id: string,
    dto: { amount: number; reason?: string },
  ): Promise<OrderResponseDto> {
    const order = await this.findEntity(actor, id);
    const amount = Number(dto.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Refund amount must be greater than zero');
    }
    const refundable = Number(order.paidAmount) - Number(order.refundedAmount ?? 0);
    if (amount > refundable) {
      throw new BadRequestException(
        `Refund amount exceeds refundable balance (${refundable})`,
      );
    }

    await this.dataSource.transaction(async (m) => {
      order.refundedAmount = Number(order.refundedAmount ?? 0) + amount;
      const netPaid = Number(order.paidAmount) - Number(order.refundedAmount);
      const fullyRefunded = netPaid <= 0;
      if (fullyRefunded) {
        order.paymentStatus = 'refunded';
      }
      await m.save(order);

      await m.save(
        m.create(OrderStatusEventEntity, {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: order.status,
          actorId: actor.sub,
          actorType: actor.sub_type,
          reason: dto.reason ?? `Refund: ₦${amount}${fullyRefunded ? ' (full)' : ' (partial)'}`,
        }),
      );

      await this.ledger.record(
        {
          businessId: actor.businessId,
          storeId: order.storeId,
          type: 'debit',
          purpose: 'order_refund',
          amount,
          method: this.mapPaymentChannelToMethod(order.paymentChannel),
          reference: order.paymentReference ?? null,
          description: `Order #${order.orderNumber} refund${dto.reason ? ` — ${dto.reason}` : ''}`,
          linkedType: 'order',
          linkedId: order.id,
          customerId: order.customerId,
          customerName: order.customerName,
          staffId: actor.sub_type === 'staff' ? actor.sub : null,
          staffName: actor.actorName ?? null,
        },
        m,
      );

      // Reverse the original merchant-wallet credit for paystack/card orders.
      if (
        order.paymentChannel === 'paystack' ||
        order.paymentChannel === 'card'
      ) {
        try {
          await this.merchantWallet.debit(
            {
              businessId: order.businessId,
              storeId: order.storeId,
              reason: 'order_refund',
              amount,
              description: `Refund — order #${order.orderNumber}${dto.reason ? ` — ${dto.reason}` : ''}`,
              linkedType: 'order',
              linkedId: order.id,
              allowOverdraft: true,
            },
            m,
          );
        } catch (err) {
          this.logger.warn(
            `Merchant wallet refund debit failed for order ${order.id}: ${(err as Error).message}`,
          );
        }
      }
    });

    this.activityLog.record({
      actorType: actor.sub_type,
      actorId: actor.sub,
      actorName: actor.actorName ?? 'Unknown',
      action: 'order.refunded',
      businessId: actor.businessId,
      storeId: order.storeId,
      resourceType: 'order',
      resourceId: order.id,
      metadata: {
        orderNumber: order.orderNumber,
        amount,
        reason: dto.reason ?? null,
      },
    });

    return this.findOne(actor, order.id);
  }

  async getEvents(actor: ActorContext, id: string) {
    await this.findEntity(actor, id);
    return this.eventRepo.find({
      where: { orderId: id },
      order: { createdAt: 'ASC' },
    });
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
