import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChowdeckIntegrationEntity } from './entities/chowdeck-integration.entity';
import { ChowdeckMenuItemEntity } from './entities/chowdeck-menu-item.entity';
import { ProductEntity } from '../products/entities/product.entity';
import { CategoryEntity } from '../categories/entities/category.entity';
import { StoreEntity } from '../store/entities/store.entity';
import { OrderEntity } from '../orders/entities/order.entity';
import { ChowdeckClient } from './chowdeck.client';
import { ChowdeckService } from './chowdeck.service';
import { ChowdeckIngestService } from './chowdeck-ingest.service';
import { ChowdeckController } from './chowdeck.controller';
import { ChowdeckWebhookController } from './chowdeck-webhook.controller';
import { OrdersModule } from '../orders/orders.module';
import { CustomersModule } from '../customers/customers.module';

/**
 * Chowdeck omnichannel integration.
 *
 * Mutually recursive with OrdersModule — ingest creates orders through
 * OrdersService, and OrdersService pushes status changes back out — so both
 * sides use forwardRef.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChowdeckIntegrationEntity,
      ChowdeckMenuItemEntity,
      ProductEntity,
      CategoryEntity,
      StoreEntity,
      OrderEntity,
    ]),
    forwardRef(() => OrdersModule),
    CustomersModule,
  ],
  controllers: [ChowdeckController, ChowdeckWebhookController],
  providers: [ChowdeckClient, ChowdeckService, ChowdeckIngestService],
  exports: [ChowdeckService, ChowdeckClient],
})
export class ChowdeckModule {}
