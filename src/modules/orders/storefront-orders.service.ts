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
import { LoyaltyService } from '../loyalty/loyalty.service';
import { BusinessService } from '../business/business.service';
import { MerchantWalletService } from '../merchant-wallet/merchant-wallet.service';
import { ReferralsService } from '../referrals/referrals.service';
import { ProductEntity } from '../products/entities/product.entity';
import { ProductVariationEntity } from '../products/entities/product-variation.entity';
import { ComboEntity } from '../combos/entities/combo.entity';
import {
  PointsTransactionEntity,
  PointsTransactionType,
} from '../customers/entities/wallet-transaction.entity';
import { PaystackService } from '../paystack/paystack.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { FinancialTransactionsService } from '../financial-transactions/financial-transactions.service';
import { TransactionMethod } from '../financial-transactions/entities/financial-transaction.entity';
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

interface ResolvedLine {
  productId: string | null;
  comboId: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  variation: Record<string, unknown> | null;
  addons: Record<string, unknown>[] | null;
  notes?: string | null;
  categoryId: string | null;
}

/** Great-circle distance between two lat/lng pairs, in kilometres. */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // earth radius (km)
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(ProductVariationEntity)
    private readonly variationRepo: Repository<ProductVariationEntity>,
    @InjectRepository(ComboEntity)
    private readonly comboRepo: Repository<ComboEntity>,
    private readonly dataSource: DataSource,
    private readonly customersService: CustomersService,
    private readonly couponsService: CouponsService,
    private readonly activityLog: ActivityLogService,
    private readonly paystack: PaystackService,
    private readonly integrations: IntegrationsService,
    private readonly ledger: FinancialTransactionsService,
    private readonly loyalty: LoyaltyService,
    private readonly referrals: ReferralsService,
    private readonly business: BusinessService,
    private readonly merchantWallet: MerchantWalletService,
  ) {}

  /**
   * Resolves THIS business's enabled Paystack credentials. Strictly scoped to
   * the passed businessId so a customer's payment is always processed on their
   * own merchant's Paystack account — never the platform's or another
   * merchant's. Throws a clear, customer-facing error when not configured.
   */
  private async requirePaystackCreds(businessId: string) {
    const cred = await this.integrations.getActiveCredential(
      businessId,
      'paystack',
    );
    if (!cred?.secretKey) {
      throw new BadRequestException(
        'Card payment is unavailable — this store has not set up its Paystack keys yet.',
      );
    }
    return cred;
  }

  /**
   * Resolves the paying merchant's Paystack secret from a payment reference —
   * used to verify webhooks against the correct merchant's account. Returns
   * undefined if the order/credential can't be found (caller falls back to the
   * platform key).
   */
  async paystackSecretForReference(
    reference: string,
  ): Promise<string | undefined> {
    const order = await this.orderRepo.findOne({
      where: { paymentReference: reference },
    });
    if (!order) return undefined;
    const cred = await this.integrations.getActiveCredential(
      order.businessId,
      'paystack',
    );
    return cred?.secretKey;
  }

  private mapPaymentChannelToMethod(
    ch: OrderEntity['paymentChannel'] | null | undefined,
  ): TransactionMethod {
    if (ch === 'paystack') return 'paystack';
    if (ch === 'card') return 'card';
    if (ch === 'cash') return 'cash';
    if (ch === 'wallet') return 'wallet';
    if (ch === 'points') return 'points';
    return 'other';
  }

  async place(
    user: UserJwtPayload,
    dto: StorefrontCreateOrderDto,
  ): Promise<PlaceOrderResult> {
    // ---------- Pre-flight (no DB writes yet) ----------
    const store = await this.storeRepo.findOne({
      where: { id: dto.storeId, businessId: user.businessId },
    });
    if (!store) throw new NotFoundException('Store not found');
    if (!store.isActive) throw new BadRequestException('Store is not active');

    const customer = await this.customerRepo.findOne({
      where: { id: user.customerId },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    // Delivery address resolution (snapshot fields onto order).
    const { deliveryAddressId, deliveryAddressSnapshot } =
      await this.resolveDeliveryAddress(user.customerId, dto);

    // Delivery radius — block if address is outside the store's reach.
    if (dto.isDelivery && store.deliveryRadiusKm != null && deliveryAddressSnapshot) {
      const lat = (deliveryAddressSnapshot as Record<string, unknown>).latitude as
        | number
        | null
        | undefined;
      const lng = (deliveryAddressSnapshot as Record<string, unknown>).longitude as
        | number
        | null
        | undefined;
      if (
        store.latitude != null &&
        store.longitude != null &&
        lat != null &&
        lng != null
      ) {
        const km = haversineKm(
          Number(store.latitude),
          Number(store.longitude),
          Number(lat),
          Number(lng),
        );
        if (km > Number(store.deliveryRadiusKm)) {
          throw new BadRequestException(
            `Sorry, this address is outside our ${store.deliveryRadiusKm}km delivery zone.`,
          );
        }
      }
    }

    // Saved Paystack card resolution.
    let savedAuthorizationCode: string | undefined;
    if (dto.savedPaymentMethodId) {
      if (dto.paymentChannel !== 'paystack') {
        throw new BadRequestException(
          'Saved payment methods only apply to Paystack',
        );
      }
      const method = await this.paymentMethodRepo.findOne({
        where: { id: dto.savedPaymentMethodId, customerId: user.customerId },
      });
      if (!method) throw new NotFoundException('Saved payment method not found');
      savedAuthorizationCode = method.authorizationCode;
    }

    // Resolve every line item against the menu — recompute unit price + name.
    const lines = await this.resolveLineItems(dto.storeId, dto.items);
    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);

    // Pricing config from settings.
    const [bizSettings, loyaltySettings] = await Promise.all([
      this.business.getSettings(user.businessId),
      this.loyalty.getSettings(user.businessId),
    ]);
    const taxRate = Number(bizSettings.taxRate ?? 0);
    const nairaPerPoint = Number(loyaltySettings.nairaPerPoint ?? 0);

    const tipAmount = Number(dto.tipAmount ?? 0);
    const deliveryFee = dto.isDelivery
      ? this.computeDeliveryFee(subtotal, store)
      : 0;
    const taxAmount =
      Math.round((subtotal + deliveryFee) * taxRate * 100) / 100;

    // Coupon validation (held for in-tx redemption).
    if (dto.couponCode) await this.validateCouponPreflight(user, dto, lines, subtotal);

    // Points pre-check (final commit happens inside the locked tx below).
    const pointsToRedeem = Math.max(0, Math.floor(dto.pointsToRedeem ?? 0));
    const pointsValue =
      pointsToRedeem > 0 ? Math.floor(pointsToRedeem * nairaPerPoint) : 0;
    if (pointsToRedeem > 0 && pointsToRedeem > customer.points) {
      throw new BadRequestException('Insufficient loyalty points');
    }

    // Schedule validation (only block when openingHours are configured).
    if (dto.scheduledFor) {
      this.assertScheduledForOpen(store, new Date(dto.scheduledFor));
    } else if (store.openingHours && !this.isStoreOpenAt(store, new Date())) {
      throw new BadRequestException(
        'Store is currently closed — please pick a later time slot.',
      );
    }

    // ---------- Atomic commit (order + status event + coupon + wallet/points) ----------
    const orderRef = `ORD_${Date.now()}_${randomUUID().slice(0, 8)}`;
    let couponRedemption: { couponId: string; redemptionId: string } | null = null;

    const saved = await this.dataSource.transaction(async (mgr) => {
      // Lock the customer row before checking + debiting wallet/points.
      const customerLocked = await mgr
        .getRepository(CustomerEntity)
        .createQueryBuilder('c')
        .setLock('pessimistic_write')
        .where('c.id = :id', { id: customer.id })
        .getOne();
      if (!customerLocked) throw new NotFoundException('Customer not found');

      let couponDiscount = 0;
      let couponCode: string | null = null;
      let couponId: string | null = null;
      if (dto.couponCode) {
        const couponItems = lines.map((l) => ({
          productId: l.productId,
          categoryId: l.categoryId,
          lineTotal: l.lineTotal,
        }));
        const result = await this.couponsService.redeem(
          user.businessId,
          user.customerId,
          dto.couponCode,
          subtotal,
          null,
          couponItems,
          mgr,
        );
        couponDiscount = result.discountAmount;
        couponCode = result.coupon.code;
        couponId = result.coupon.id;
        couponRedemption = {
          couponId: result.coupon.id,
          redemptionId: result.redemptionId,
        };
      }

      const grossTotal =
        subtotal + taxAmount + deliveryFee + tipAmount - couponDiscount - pointsValue;
      const total = Math.max(0, Math.round(grossTotal * 100) / 100);

      if (dto.paymentChannel === 'wallet') {
        if (Number(customerLocked.walletBalance) < total) {
          throw new BadRequestException('Insufficient wallet balance');
        }
      }

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
        pointsRedeemed: pointsToRedeem,
        notes: dto.notes ?? null,
        deliveryFee,
        tipAmount,
        couponCode,
        couponId,
        couponRedemptionId: couponRedemption?.redemptionId ?? null,
        couponDiscount,
        deliveryAddressId,
        deliveryAddress: deliveryAddressSnapshot,
        scheduledFor: dto.scheduledFor ? new Date(dto.scheduledFor) : null,
        paymentChannel: dto.paymentChannel,
        paymentReference: orderRef,
        paymentStatus: 'pending',
        items: lines.map((l) =>
          mgr.create(OrderItemEntity, {
            productId: l.productId ?? null,
            comboId: l.comboId ?? null,
            name: l.name,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            subtotal: l.lineTotal,
            variation: l.variation,
            addons: l.addons,
            notes: l.notes ?? null,
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

      if (dto.paymentChannel === 'wallet' && total > 0) {
        customerLocked.walletBalance =
          Number(customerLocked.walletBalance) - total;
        await mgr.getRepository(CustomerEntity).save(customerLocked);
      }
      if (pointsToRedeem > 0) {
        customerLocked.points = customerLocked.points - pointsToRedeem;
        await mgr.getRepository(CustomerEntity).save(customerLocked);
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

    // ---------- Post-commit payment work ----------
    let payment: PlaceOrderResult['payment'];
    const total = Number(saved.total);
    try {
      if (dto.paymentChannel === 'paystack' && total > 0) {
        // Tenant-scoped: always this merchant's own Paystack account.
        const creds = await this.requirePaystackCreds(user.businessId);
        if (savedAuthorizationCode) {
          const verified = await this.paystack.chargeAuthorization(
            {
              email: this.emailFor(customer),
              amount: Math.round(total * 100),
              authorizationCode: savedAuthorizationCode,
              reference: saved.paymentReference!,
              metadata: { orderId: saved.id, orderNumber: saved.orderNumber },
            },
            creds.secretKey,
          );
          if (verified.status !== 'success') {
            throw new BadRequestException(
              'Card authorization failed. Please try again.',
            );
          }
          await this.markOrderPaid(saved.id, verified.reference);
          payment = { requiresAction: false, reference: verified.reference };
        } else {
          if (!creds.publicKey) {
            throw new BadRequestException(
              'Card payment is unavailable — this store has not set its Paystack public key.',
            );
          }
          const init = await this.paystack.initialize(
            {
              email: this.emailFor(customer),
              amount: Math.round(total * 100),
              reference: saved.paymentReference!,
              metadata: { orderId: saved.id, orderNumber: saved.orderNumber },
            },
            creds.secretKey,
          );
          payment = {
            requiresAction: true,
            authorizationUrl: init.authorizationUrl,
            accessCode: init.accessCode,
            reference: init.reference,
            publicKey: creds.publicKey,
          };
        }
      } else if (
        dto.paymentChannel === 'wallet' ||
        dto.paymentChannel === 'points'
      ) {
        await this.markOrderPaid(saved.id, saved.paymentReference!);
      }
      // cash → leave pending
    } catch (err) {
      // Compensate: reverse coupon, wallet, points, mark order failed.
      this.logger.warn(
        `Payment kickoff failed for order ${saved.id}: ${(err as Error).message}. Rolling back.`,
      );
      await this.compensatePlacement(saved.id, couponRedemption ?? undefined).catch(
        (e) => this.logger.error(`Compensation failed for ${saved.id}: ${e}`),
      );
      throw err instanceof BadRequestException
        ? err
        : new BadRequestException(
            'Payment could not be initiated. Your wallet and coupon were not charged.',
          );
    }

    // Customer aggregates (denormalised). Wallet/points already debited.
    await this.customersService.recordOrder(customer.id, {
      ordersDelta: 1,
      spentDelta: total,
      orderAt: saved.createdAt,
    });

    const fresh = await this.orderRepo.findOne({
      where: { id: saved.id },
      relations: ['items'],
    });
    return { order: OrderResponseDto.from(fresh ?? saved), payment };
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
    // Verify against this merchant's own Paystack account.
    const creds = await this.requirePaystackCreds(user.businessId);
    const verified = await this.paystack.verify(reference, creds.secretKey);
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
    if (order.paymentStatus === 'paid') return;
    const previouslyPaid = Number(order.paidAmount ?? 0);
    const total = Number(order.total);
    const delta = Math.max(0, total - previouslyPaid);
    order.paymentStatus = 'paid';
    order.paymentReference = reference;
    order.paidAt = new Date();
    order.paidAmount = total;
    await this.orderRepo.save(order);

    if (delta > 0) {
      await this.ledger.record({
        businessId: order.businessId,
        storeId: order.storeId,
        type: 'credit',
        purpose: 'order_payment',
        amount: delta,
        method: this.mapPaymentChannelToMethod(order.paymentChannel),
        reference,
        description: `Order #${order.orderNumber} payment (storefront)`,
        linkedType: 'order',
        linkedId: order.id,
        customerId: order.customerId,
        customerName: order.customerName,
      });

      // Credit the merchant wallet only when the payment brought new money
      // into the business (paystack online). Cash/wallet/points don't credit
      // the payout wallet — cash sits in the till, wallet/points are
      // intra-account movement.
      if (order.paymentChannel === 'paystack') {
        try {
          await this.merchantWallet.credit({
            businessId: order.businessId,
            storeId: order.storeId,
            reason: 'order_payment',
            amount: delta,
            description: `Order #${order.orderNumber} (storefront)`,
            linkedType: 'order',
            linkedId: order.id,
          });
        } catch (err) {
          this.logger.warn(
            `Merchant wallet credit failed for order ${order.id}: ${(err as Error).message}`,
          );
        }
      }
    }

    // Award loyalty points + unlock any pending referral reward.
    if (order.customerId) {
      try {
        const settings = await this.loyalty.getSettings(order.businessId);
        const earned = Math.floor(
          Number(order.total) * Number(settings.pointsPerNaira ?? 0),
        );
        if (earned > 0) {
          await this.awardPointsForOrder(
            order.customerId,
            order.businessId,
            earned,
            order.id,
          );
        }
      } catch (err) {
        this.logger.warn(
          `Loyalty points award failed for order ${order.id}: ${(err as Error).message}`,
        );
      }
      try {
        await this.referrals.recordFirstPurchase(
          order.businessId,
          order.customerId,
          order.id,
        );
      } catch (err) {
        this.logger.warn(
          `Referral reward release failed for order ${order.id}: ${(err as Error).message}`,
        );
      }
    }
  }

  /**
   * Credit loyalty points to the customer and write a transaction log.
   * Mirrors CustomersService.addPoints but lets us run inside any transaction
   * boundary; uses the customer repository directly to avoid the actor-context
   * required by the customers module.
   */
  private async awardPointsForOrder(
    customerId: string,
    businessId: string,
    points: number,
    orderId: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (mgr) => {
      const customer = await mgr
        .getRepository(CustomerEntity)
        .findOne({ where: { id: customerId, businessId } });
      if (!customer) return;
      customer.points = Number(customer.points) + points;
      await mgr.getRepository(CustomerEntity).save(customer);

      await mgr.getRepository(PointsTransactionEntity).save(
        mgr.getRepository(PointsTransactionEntity).create({
          customerId,
          type: PointsTransactionType.EARNED,
          points,
          balance: customer.points,
          description: `Earned for order paid`,
          orderId,
        }),
      );
    });
  }

  private async markOrderFailed(orderId: string): Promise<void> {
    await this.orderRepo.update(orderId, { paymentStatus: 'failed' });
  }

  private computeDeliveryFee(_subtotal: number, store: StoreEntity): number {
    // Flat per-store fee — admins set this on the store edit form.
    return Number(store.deliveryFee ?? 0);
  }

  private emailFor(customer: CustomerEntity): string {
    return customer.email ?? `customer-${customer.id}@no-email.local`;
  }

  /**
   * Resolves a delivery address either by saved id or via inline payload.
   * Snapshots the saved address fields onto the order so renaming/deleting it
   * later doesn't change order history.
   */
  private async resolveDeliveryAddress(
    customerId: string,
    dto: StorefrontCreateOrderDto,
  ): Promise<{
    deliveryAddressId: string | null;
    deliveryAddressSnapshot: Record<string, unknown> | null;
  }> {
    if (!dto.isDelivery)
      return { deliveryAddressId: null, deliveryAddressSnapshot: null };
    if (dto.deliveryAddressId) {
      const address = await this.addressRepo.findOne({
        where: { id: dto.deliveryAddressId, customerId },
      });
      if (!address) throw new NotFoundException('Delivery address not found');
      return {
        deliveryAddressId: address.id,
        deliveryAddressSnapshot: {
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
        },
      };
    }
    if (dto.deliveryAddress) {
      return {
        deliveryAddressId: null,
        deliveryAddressSnapshot: dto.deliveryAddress,
      };
    }
    throw new BadRequestException(
      'Delivery address is required for delivery orders',
    );
  }

  /**
   * Server-side line-item validation. Re-derives unit price from the product +
   * variation (or combo) so the customer can't tamper with the price client
   * side. Rejects anything that's missing, inactive, in another store, or
   * out of stock.
   */
  private async resolveLineItems(
    storeId: string,
    items: StorefrontCreateOrderDto['items'],
  ): Promise<ResolvedLine[]> {
    const productIds = Array.from(
      new Set(items.map((i) => i.productId).filter((id): id is string => !!id)),
    );
    const comboIds = Array.from(
      new Set(items.map((i) => i.comboId).filter((id): id is string => !!id)),
    );

    const products = productIds.length
      ? await this.productRepo.find({
          where: productIds.map((id) => ({ id })),
        })
      : [];
    const combos = comboIds.length
      ? await this.comboRepo.find({ where: comboIds.map((id) => ({ id })) })
      : [];
    const variationIds = Array.from(
      new Set(
        items
          .map((i) => i.variationId)
          .filter((v): v is string => !!v),
      ),
    );
    const variations = variationIds.length
      ? await this.variationRepo.find({
          where: variationIds.map((id) => ({ id })),
        })
      : [];

    const productById = new Map(products.map((p) => [p.id, p]));
    const comboById = new Map(combos.map((c) => [c.id, c]));
    const variationById = new Map(variations.map((v) => [v.id, v]));

    const out: ResolvedLine[] = [];
    for (const i of items) {
      if (!i.productId && !i.comboId) {
        throw new BadRequestException(
          `Line "${i.name}" must include either a productId or comboId`,
        );
      }
      if (i.productId) {
        const p = productById.get(i.productId);
        if (!p) throw new BadRequestException(`Product ${i.productId} not found`);
        if (p.storeId !== storeId)
          throw new BadRequestException(
            `Product "${p.name}" is not available at this store`,
          );
        if (!p.status)
          throw new BadRequestException(
            `Product "${p.name}" is not available right now`,
          );
        let unitPrice = Number(p.sellingPrice ?? p.price ?? 0);
        let stock = p.stock ?? 0;
        let displayName = p.name;
        if (i.variationId) {
          const v = variationById.get(i.variationId);
          if (!v || v.productId !== p.id)
            throw new BadRequestException(
              `Selected variation is not valid for "${p.name}"`,
            );
          unitPrice = Number(v.sellingPrice ?? v.price ?? unitPrice);
          stock = v.stock ?? stock;
          displayName = `${p.name} (${v.name})`;
        }
        if (stock === 0)
          throw new BadRequestException(
            `"${displayName}" is out of stock`,
          );
        if (i.quantity > stock)
          throw new BadRequestException(
            `Only ${stock} of "${displayName}" left in stock`,
          );
        out.push({
          productId: p.id,
          comboId: null,
          name: displayName,
          quantity: i.quantity,
          unitPrice,
          lineTotal: unitPrice * i.quantity,
          variation: i.variation ?? (i.variationId
            ? { id: i.variationId, name: variationById.get(i.variationId)?.name ?? null }
            : null),
          addons: i.addons ?? null,
          notes: i.notes,
          categoryId: p.categoryId ?? null,
        });
        continue;
      }
      // Combo line
      const c = comboById.get(i.comboId!);
      if (!c) throw new BadRequestException(`Combo ${i.comboId} not found`);
      if (c.storeId !== storeId)
        throw new BadRequestException(
          `Combo "${c.name}" is not available at this store`,
        );
      if (!c.isActive)
        throw new BadRequestException(
          `Combo "${c.name}" is not available right now`,
        );
      const unitPrice = Number(c.price ?? 0);
      out.push({
        productId: null,
        comboId: c.id,
        name: c.name,
        quantity: i.quantity,
        unitPrice,
        lineTotal: unitPrice * i.quantity,
        variation: null,
        addons: null,
        notes: i.notes,
        categoryId: null,
      });
    }
    return out;
  }

  /**
   * Cheap dry-run of the coupon to surface a 4xx before we open the order
   * transaction. The actual atomic redeem still happens inside the tx.
   */
  private async validateCouponPreflight(
    user: UserJwtPayload,
    dto: StorefrontCreateOrderDto,
    lines: ResolvedLine[],
    subtotal: number,
  ): Promise<void> {
    const couponItems = lines.map((l) => ({
      productId: l.productId ?? undefined,
      categoryId: l.categoryId ?? undefined,
      lineTotal: l.lineTotal,
    }));
    const result = await this.couponsService.validate(
      user.businessId,
      user.customerId,
      dto.couponCode!,
      subtotal,
      couponItems,
    );
    if (!result.valid)
      throw new BadRequestException(result.reason ?? 'Coupon is not valid');
  }

  /** True if the store's `openingHours` allow service at the given moment. */
  private isStoreOpenAt(store: StoreEntity, when: Date): boolean {
    if (!store.openingHours) return true;
    const day = this.weekdayKey(when);
    const slot = store.openingHours[day];
    if (!slot || slot.closed) return false;
    const minutes = when.getHours() * 60 + when.getMinutes();
    const [oh, om] = slot.open.split(':').map((x) => parseInt(x, 10));
    const [ch, cm] = slot.close.split(':').map((x) => parseInt(x, 10));
    return minutes >= oh * 60 + om && minutes <= ch * 60 + cm;
  }

  private assertScheduledForOpen(store: StoreEntity, when: Date): void {
    if (when.getTime() < Date.now() - 60_000) {
      throw new BadRequestException('Scheduled time must be in the future');
    }
    if (!this.isStoreOpenAt(store, when)) {
      throw new BadRequestException(
        'Store is closed at the selected time — please pick another slot.',
      );
    }
  }

  private weekdayKey(
    d: Date,
  ):
    | 'monday'
    | 'tuesday'
    | 'wednesday'
    | 'thursday'
    | 'friday'
    | 'saturday'
    | 'sunday' {
    const keys = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ] as const;
    return keys[d.getDay()];
  }

  /**
   * Reverse the wallet/points debits and coupon redemption that were committed
   * with the order, and mark the order failed. Used when post-commit payment
   * kickoff fails so the customer doesn't lose their funds. Idempotent —
   * checks paymentStatus before doing any reversals.
   */
  private async compensatePlacement(
    orderId: string,
    couponRedemption?: { couponId: string; redemptionId: string },
  ): Promise<void> {
    await this.dataSource.transaction(async (mgr) => {
      const order = await mgr
        .getRepository(OrderEntity)
        .findOne({ where: { id: orderId } });
      if (!order) return;
      if (order.paymentStatus === 'paid') return;
      if (order.status === OrderStatus.CANCELLED) return;

      // Restore wallet
      if (order.paymentChannel === 'wallet' && Number(order.total) > 0) {
        const c = await mgr
          .getRepository(CustomerEntity)
          .findOne({ where: { id: order.customerId! } });
        if (c) {
          c.walletBalance = Number(c.walletBalance) + Number(order.total);
          await mgr.getRepository(CustomerEntity).save(c);
        }
      }
      // Restore points
      if (order.pointsRedeemed > 0) {
        const c = await mgr
          .getRepository(CustomerEntity)
          .findOne({ where: { id: order.customerId! } });
        if (c) {
          c.points = c.points + order.pointsRedeemed;
          await mgr.getRepository(CustomerEntity).save(c);
          await mgr.getRepository(PointsTransactionEntity).save(
            mgr.getRepository(PointsTransactionEntity).create({
              customerId: c.id,
              type: PointsTransactionType.ADJUSTED,
              points: order.pointsRedeemed,
              balance: c.points,
              description: `Refund — order #${order.orderNumber} cancelled before payment`,
              orderId: order.id,
            }),
          );
        }
      }
      // Release coupon
      const couponId = couponRedemption?.couponId ?? order.couponId;
      const redemptionId = couponRedemption?.redemptionId ?? order.couponRedemptionId;
      if (couponId) {
        await this.couponsService.unredeem(couponId, redemptionId, mgr);
      }
      order.status = OrderStatus.CANCELLED;
      order.paymentStatus = 'failed';
      await mgr.getRepository(OrderEntity).save(order);
      await mgr.save(
        mgr.create(OrderStatusEventEntity, {
          orderId: order.id,
          fromStatus: OrderStatus.PENDING,
          toStatus: OrderStatus.CANCELLED,
          actorId: null,
          actorType: 'system',
          reason: 'Payment kickoff failed',
        }),
      );
    });
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
