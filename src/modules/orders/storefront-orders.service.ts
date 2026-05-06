import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  OrderEntity,
  OrderStatus,
} from './entities/order.entity';
import { OrderItemEntity } from './entities/order-item.entity';
import { OrderStatusEventEntity } from './entities/order-status-event.entity';
import {
  StorefrontCreateOrderDto,
  StorefrontPaymentChannel,
} from './dto/storefront-create-order.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { StoreEntity } from '../store/entities/store.entity';
import { CustomerEntity } from '../customers/entities/customer.entity';
import { CustomerAddressEntity } from '../customer-addresses/entities/customer-address.entity';
import {
  CustomerPaymentMethodEntity,
  PaymentMethodBrand,
} from '../customer-payment-methods/entities/customer-payment-method.entity';
import { CustomersService } from '../customers/customers.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CouponsService } from '../coupons/coupons.service';
import { PaystackService } from '../paystack/paystack.service';
import { UserJwtPayload } from '../../common/types/jwt-payload.types';

export interface PlaceOrderResult {
  order: OrderResponseDto;
  payment?: {
    requiresAction: boolean;
    authorizationUrl?: string;
    accessCode?: string;
    reference?: string;
    publicKey?: string;
  };
}

@Injectable()
export class StorefrontOrdersService {
  private readonly logger = new Logger(StorefrontOrdersService.name);

  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    @InjectRepository(StoreEntity)
    private readonly storeRepo: Repository<StoreEntity>,
    @InjectRepository(CustomerEntity)
    private readonly customerRepo: Repository<CustomerEntity>,
    @InjectRepository(CustomerAddressEntity)
    private readonly addressRepo: Repository<CustomerAddressEntity>,
    @InjectRepository(CustomerPaymentMethodEntity)
    private readonly paymentMethodRepo: Repository<CustomerPaymentMethodEntity>,
    private readonly dataSource: DataSource,
    private readonly customersService: CustomersService,
    private readonly couponsService: CouponsService,
    private readonly activityLog: ActivityLogService,
    private readonly paystack: PaystackService,
  ) {}

  async place(
    user: UserJwtPayload,
    dto: StorefrontCreateOrderDto,
  ): Promise<PlaceOrderResult> {
    // ---------- Validate store ----------
    const store = await this.storeRepo.findOne({
      where: { id: dto.storeId, businessId: user.businessId },
    });
    if (!store) throw new NotFoundException('Store not found');
    if (!store.isActive) throw new BadRequestException('Store is not active');

    // ---------- Resolve customer ----------
    const customer = await this.customerRepo.findOne({
      where: { id: user.customerId },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    // ---------- Resolve delivery address ----------
    let deliveryAddressSnapshot: Record<string, unknown> | null = null;
    let deliveryAddressId: string | null = null;
    if (dto.isDelivery) {
      if (dto.deliveryAddressId) {
        const address = await this.addressRepo.findOne({
          where: {
            id: dto.deliveryAddressId,
            customerId: user.customerId,
          },
        });
        if (!address) throw new NotFoundException('Delivery address not found');
        deliveryAddressId = address.id;
        deliveryAddressSnapshot = {
          label: address.label,
          line1: address.line1,
          line2: address.line2,
          city: address.city,
          state: address.state,
          country: address.country,
          zipCode: address.zipCode,
          latitude: address.latitude == null ? null : Number(address.latitude),
          longitude: address.longitude == null ? null : Number(address.longitude),
          notes: address.notes,
        };
      } else if (dto.deliveryAddress) {
        deliveryAddressSnapshot = dto.deliveryAddress;
      } else {
        throw new BadRequestException(
          'Delivery address is required for delivery orders',
        );
      }
    }

    // ---------- Resolve saved payment method ----------
    let savedAuthorizationCode: string | undefined;
    if (dto.savedPaymentMethodId) {
      if (dto.paymentChannel !== 'paystack') {
        throw new BadRequestException(
          'Saved payment methods only apply to Paystack',
        );
      }
      const method = await this.paymentMethodRepo.findOne({
        where: {
          id: dto.savedPaymentMethodId,
          customerId: user.customerId,
        },
      });
      if (!method) throw new NotFoundException('Saved payment method not found');
      savedAuthorizationCode = method.authorizationCode;
    }

    // ---------- Compute totals ----------
    const subtotal = dto.items.reduce(
      (sum, i) => sum + Number(i.unitPrice) * i.quantity,
      0,
    );
    const tipAmount = Number(dto.tipAmount ?? 0);
    const deliveryFee = dto.isDelivery
      ? this.computeDeliveryFee(subtotal, store)
      : 0;
    // Tax: 7.5% VAT on (subtotal + delivery)
    const taxAmount = Math.round((subtotal + deliveryFee) * 0.075 * 100) / 100;

    // ---------- Coupon redemption (atomic) ----------
    let couponDiscount = 0;
    let couponCode: string | null = null;
    if (dto.couponCode) {
      const result = await this.couponsService.redeem(
        user.businessId,
        user.customerId,
        dto.couponCode,
        subtotal,
        null,
      );
      couponDiscount = result.discountAmount;
      couponCode = result.coupon.code;
    }

    // ---------- Points redemption ----------
    const pointsToRedeem = dto.pointsToRedeem ?? 0;
    const pointsValue = Math.floor(pointsToRedeem / 10); // 10 pts = ₦1
    if (pointsToRedeem > 0) {
      if (pointsToRedeem > customer.points) {
        throw new BadRequestException('Insufficient loyalty points');
      }
    }

    const grossTotal =
      subtotal + taxAmount + deliveryFee + tipAmount - couponDiscount - pointsValue;
    const total = Math.max(0, Math.round(grossTotal * 100) / 100);

    // ---------- Wallet check ----------
    if (dto.paymentChannel === 'wallet') {
      if (Number(customer.walletBalance) < total) {
        throw new BadRequestException('Insufficient wallet balance');
      }
    }

    // ---------- Persist the order ----------
    const orderRef = `ORD_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const saved = await this.dataSource.transaction(async (mgr) => {
      const orderNumber = await this.nextOrderNumber(mgr, dto.storeId);

      const order = mgr.create(OrderEntity, {
        orderNumber,
        businessId: user.businessId,
        storeId: dto.storeId,
        staffId: null,
        staffName: null,
        customerId: customer.id,
        customerName: `${customer.firstName} ${customer.lastName}`.trim(),
        customerPhone: customer.phone,
        tableNumber: null,
        channel: 'website',
        isDelivery: dto.isDelivery,
        status: OrderStatus.PENDING,
        subtotal,
        taxAmount,
        discountAmount: couponDiscount + pointsValue,
        total,
        paidAmount: 0,
        notes: dto.notes ?? null,
        deliveryFee,
        tipAmount,
        couponCode,
        couponDiscount,
        deliveryAddressId,
        deliveryAddress: deliveryAddressSnapshot,
        scheduledFor: dto.scheduledFor ? new Date(dto.scheduledFor) : null,
        paymentChannel: dto.paymentChannel,
        paymentReference: orderRef,
        paymentStatus: 'pending',
        items: dto.items.map((i) =>
          mgr.create(OrderItemEntity, {
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
      const persisted = await mgr.save(order);

      await mgr.save(
        mgr.create(OrderStatusEventEntity, {
          orderId: persisted.id,
          fromStatus: null,
          toStatus: OrderStatus.PENDING,
          actorId: user.sub,
          actorType: 'user',
        }),
      );

      // Pre-debit wallet/points (held; refunded on cancellation)
      if (dto.paymentChannel === 'wallet') {
        const customerInTx = await mgr.getRepository(CustomerEntity).findOne({
          where: { id: customer.id },
        });
        if (customerInTx) {
          customerInTx.walletBalance =
            Number(customerInTx.walletBalance) - total;
          await mgr.getRepository(CustomerEntity).save(customerInTx);
        }
      }
      if (pointsToRedeem > 0) {
        const customerInTx = await mgr.getRepository(CustomerEntity).findOne({
          where: { id: customer.id },
        });
        if (customerInTx) {
          customerInTx.points = customerInTx.points - pointsToRedeem;
          await mgr.getRepository(CustomerEntity).save(customerInTx);
        }
      }

      return persisted;
    });

    this.activityLog.record({
      actorType: 'user',
      actorId: user.sub,
      actorName: user.email,
      action: 'storefront.order_placed',
      businessId: user.businessId,
      storeId: dto.storeId,
      resourceType: 'order',
      resourceId: saved.id,
      metadata: {
        orderNumber: saved.orderNumber,
        total: Number(saved.total),
        channel: dto.paymentChannel,
        isDelivery: dto.isDelivery,
      },
    });

    // ---------- Initiate payment ----------
    let payment: PlaceOrderResult['payment'];
    if (dto.paymentChannel === 'paystack' && total > 0) {
      try {
        if (savedAuthorizationCode) {
          const verified = await this.paystack.chargeAuthorization({
            email:
              customer.email ??
              `customer-${customer.id}@no-email.local`,
            amount: Math.round(total * 100), // kobo
            authorizationCode: savedAuthorizationCode,
            reference: saved.paymentReference!,
            metadata: {
              orderId: saved.id,
              orderNumber: saved.orderNumber,
            },
          });
          if (verified.status === 'success') {
            await this.markOrderPaid(saved.id, verified.reference);
          } else {
            await this.markOrderFailed(saved.id);
            throw new BadRequestException(
              'Card authorization failed. Please try again.',
            );
          }
          payment = { requiresAction: false, reference: verified.reference };
        } else {
          const init = await this.paystack.initialize({
            email:
              customer.email ??
              `customer-${customer.id}@no-email.local`,
            amount: Math.round(total * 100),
            reference: saved.paymentReference!,
            metadata: {
              orderId: saved.id,
              orderNumber: saved.orderNumber,
            },
          });
          payment = {
            requiresAction: true,
            authorizationUrl: init.authorizationUrl,
            accessCode: init.accessCode,
            reference: init.reference,
            publicKey: this.paystack.publicKey(),
          };
        }
      } catch (err) {
        // Don't lose the order; let the customer retry payment
        this.logger.error(
          `Failed to initialise Paystack for order ${saved.id}: ${(err as Error).message}`,
        );
        if (err instanceof BadRequestException) throw err;
      }
    } else if (dto.paymentChannel === 'wallet' || dto.paymentChannel === 'points') {
      // Already pre-debited; mark paid
      await this.markOrderPaid(saved.id, saved.paymentReference!);
    } else {
      // Cash on delivery / cash on pickup — nothing to do until staff records payment
    }

    // ---------- Update customer aggregates ----------
    await this.customersService.recordOrder(customer.id, {
      ordersDelta: 1,
      spentDelta: total,
      orderAt: saved.createdAt,
    });

    // Reload to get latest payment fields
    const fresh = await this.orderRepo.findOne({
      where: { id: saved.id },
      relations: ['items'],
    });
    return {
      order: OrderResponseDto.from(fresh ?? saved),
      payment,
    };
  }

  async verifyPayment(
    user: UserJwtPayload,
    orderId: string,
    reference: string,
  ): Promise<OrderResponseDto> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId, customerId: user.customerId },
      relations: ['items'],
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.paymentStatus === 'paid') {
      return OrderResponseDto.from(order);
    }
    if (order.paymentReference && order.paymentReference !== reference) {
      throw new BadRequestException('Payment reference mismatch');
    }
    const verified = await this.paystack.verify(reference);
    if (verified.status === 'success') {
      await this.markOrderPaid(orderId, reference);
      // Persist authorization for one-click future checkouts
      if (verified.authorization?.reusable) {
        const existing = await this.paymentMethodRepo.findOne({
          where: {
            customerId: user.customerId,
            authorizationCode: verified.authorization.authorizationCode,
          },
        });
        if (!existing) {
          await this.paymentMethodRepo.save(
            this.paymentMethodRepo.create({
              businessId: user.businessId,
              customerId: user.customerId,
              brand:
                this.normaliseBrand(
                  verified.authorization.brand ??
                    verified.authorization.cardType ??
                    null,
                ),
              last4: verified.authorization.last4,
              expMonth: verified.authorization.expMonth,
              expYear: verified.authorization.expYear,
              cardholderName: null,
              authorizationCode: verified.authorization.authorizationCode,
              bin: verified.authorization.bin,
              bank: verified.authorization.bank,
              channel: verified.authorization.channel,
              isDefault: false,
            }),
          );
        }
      }
    } else {
      await this.markOrderFailed(orderId);
      throw new BadRequestException(`Payment ${verified.status}`);
    }
    const fresh = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['items'],
    });
    return OrderResponseDto.from(fresh!);
  }

  /** Webhook entry: marks the order paid via paystack reference. Idempotent. */
  async applyWebhookSuccess(reference: string): Promise<void> {
    const verified = await this.paystack.verify(reference);
    if (verified.status !== 'success') return;
    const order = await this.orderRepo.findOne({
      where: { paymentReference: reference },
    });
    if (!order) return;
    if (order.paymentStatus === 'paid') return;
    await this.markOrderPaid(order.id, reference);
  }

  private async markOrderPaid(orderId: string, reference: string): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) return;
    order.paymentStatus = 'paid';
    order.paymentReference = reference;
    order.paidAt = new Date();
    order.paidAmount = Number(order.total);
    await this.orderRepo.save(order);
  }

  private async markOrderFailed(orderId: string): Promise<void> {
    await this.orderRepo.update(orderId, { paymentStatus: 'failed' });
  }

  private computeDeliveryFee(_subtotal: number, store: StoreEntity): number {
    // Simple flat fee model. Could be replaced by zone/distance-based pricing.
    if (store.deliveryRadiusKm == null) return 0;
    return 1500; // ₦1,500 default flat delivery fee
  }

  private normaliseBrand(raw: string | null): PaymentMethodBrand {
    const r = (raw ?? '').toLowerCase();
    if (r.includes('visa')) return PaymentMethodBrand.VISA;
    if (r.includes('master')) return PaymentMethodBrand.MASTERCARD;
    if (r.includes('verve')) return PaymentMethodBrand.VERVE;
    if (r.includes('amex') || r.includes('american'))
      return PaymentMethodBrand.AMEX;
    if (r.includes('discover')) return PaymentMethodBrand.DISCOVER;
    return PaymentMethodBrand.OTHER;
  }

  private async nextOrderNumber(
    manager: DataSource['manager'],
    storeId: string,
  ): Promise<number> {
    await manager.query("SELECT pg_advisory_xact_lock(hashtext($1))", [storeId]);
    const row = await manager
      .createQueryBuilder(OrderEntity, 'o')
      .withDeleted()
      .select('COALESCE(MAX(o.orderNumber), 0)', 'max')
      .where('o.storeId = :storeId', { storeId })
      .getRawOne<{ max: string }>();
    return (parseInt(row?.max ?? '0', 10) || 0) + 1;
  }
}
