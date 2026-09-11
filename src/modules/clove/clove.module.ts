import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CloveIntegrationEntity } from './entities/clove-integration.entity';
import { CloveMenuItemEntity } from './entities/clove-menu-item.entity';
import { ProductEntity } from '../products/entities/product.entity';
import { StoreEntity } from '../store/entities/store.entity';
import { OrderEntity } from '../orders/entities/order.entity';
import { CloveClient } from './clove.client';
import { CloveService } from './clove.service';
import { CloveIngestService } from './clove-ingest.service';
import { CloveController } from './clove.controller';
import { CloveWebhookController } from './clove-webhook.controller';
import { OrdersModule } from '../orders/orders.module';
import { CustomersModule } from '../customers/customers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CloveIntegrationEntity,
      CloveMenuItemEntity,
      ProductEntity,
      StoreEntity,
      OrderEntity,
    ]),
    // Ingestion creates orders through OrdersService.
    forwardRef(() => OrdersModule),
    CustomersModule,
  ],
  controllers: [CloveController, CloveWebhookController],
  providers: [CloveClient, CloveService, CloveIngestService],
  exports: [CloveService, CloveIngestService],
})
export class CloveModule {}
