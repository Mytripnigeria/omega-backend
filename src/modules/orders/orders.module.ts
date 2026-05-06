import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderEntity } from './entities/order.entity';
import { OrderItemEntity } from './entities/order-item.entity';
import { OrderStatusEventEntity } from './entities/order-status-event.entity';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { StorefrontOrdersController } from './storefront-orders.controller';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { CustomersModule } from '../customers/customers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([OrderEntity, OrderItemEntity, OrderStatusEventEntity]),
    ActivityLogModule,
    CustomersModule,
  ],
  controllers: [OrdersController, StorefrontOrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
