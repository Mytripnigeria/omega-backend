import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderEntity } from './entities/order.entity';
import { DeliveryRegionEntity } from '../delivery-regions/entities/delivery-region.entity';
import { ComboItemEntity } from '../combos/entities/combo-item.entity';
import { AddonIngredientEntity } from '../addon-groups/entities/addon-ingredient.entity';
import { OrderItemEntity } from './entities/order-item.entity';
import { OrderStatusEventEntity } from './entities/order-status-event.entity';
import { StoreEntity } from '../store/entities/store.entity';
import { CustomerAddressEntity } from '../customer-addresses/entities/customer-address.entity';
import { CustomerPaymentMethodEntity } from '../customer-payment-methods/entities/customer-payment-method.entity';
import { ProductEntity } from '../products/entities/product.entity';
import { CustomerEntity } from '../customers/entities/customer.entity';
import {
  PointsTransactionEntity,
  WalletTransactionEntity,
} from '../customers/entities/wallet-transaction.entity';
import { PaystackModule } from '../paystack/paystack.module';
import { IntegrationsModule } from '../integrations/integrations.module';
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
import { BusinessModule } from '../business/business.module';
import { ComboEntity } from '../combos/entities/combo.entity';
import { ProductVariationEntity } from '../products/entities/product-variation.entity';
import { TableEntity } from '../tables/entities/table.entity';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { ProductIngredientEntity } from '../products/entities/product-ingredient.entity';
import { IngredientEntity } from '../ingredients/entities/ingredient.entity';
import { IngredientMovementEntity } from '../ingredients/entities/ingredient-movement.entity';
import { IngredientLocationStockEntity } from '../ingredients/entities/ingredient-location-stock.entity';
import { WorkstationSettingsEntity } from '../workstation-settings/entities/workstation-settings.entity';
import { DeliveryEntity } from '../deliveries/entities/delivery.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrderEntity,
      OrderItemEntity,
      OrderStatusEventEntity,
      DeliveryEntity,
      WorkstationSettingsEntity,
      StoreEntity,
      CustomerAddressEntity,
      CustomerPaymentMethodEntity,
      ProductEntity,
      ProductVariationEntity,
      ComboEntity,
      CustomerEntity,
      WalletTransactionEntity,
      PointsTransactionEntity,
      TableEntity,
      ProductIngredientEntity,
      IngredientEntity,
      IngredientMovementEntity,
      IngredientLocationStockEntity,
      DeliveryRegionEntity,
      ComboItemEntity,
      AddonIngredientEntity,
    ]),
    ActivityLogModule,
    CustomersModule,
    CouponsModule,
    LoyaltyModule,
    ReferralsModule,
    BusinessModule,
    PaystackModule,
    IntegrationsModule,
    PushNotificationsModule,
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
