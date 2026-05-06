import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderEntity } from './entities/order.entity';
import { OrderItemEntity } from './entities/order-item.entity';
import { OrderStatusEventEntity } from './entities/order-status-event.entity';
import { StoreEntity } from '../store/entities/store.entity';
import { CustomerAddressEntity } from '../customer-addresses/entities/customer-address.entity';
import { CustomerPaymentMethodEntity } from '../customer-payment-methods/entities/customer-payment-method.entity';
import { ProductEntity } from '../products/entities/product.entity';
import { OrdersService } from './orders.service';
import { StorefrontOrdersService } from './storefront-orders.service';
import { OrdersController } from './orders.controller';
import {
  PaystackWebhookController,
  StorefrontOrdersController,
} from './storefront-orders.controller';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { CustomersModule } from '../customers/customers.module';
import { CouponsModule } from '../coupons/coupons.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { ReferralsModule } from '../referrals/referrals.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrderEntity,
      OrderItemEntity,
      OrderStatusEventEntity,
      StoreEntity,
      CustomerAddressEntity,
      CustomerPaymentMethodEntity,
      ProductEntity,
    ]),
    ActivityLogModule,
    CustomersModule,
    CouponsModule,
    LoyaltyModule,
    ReferralsModule,
  ],
  controllers: [
    OrdersController,
    StorefrontOrdersController,
    PaystackWebhookController,
  ],
  providers: [OrdersService, StorefrontOrdersService],
  exports: [OrdersService, StorefrontOrdersService],
})
export class OrdersModule {}
