import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeliveryEntity } from './entities/delivery.entity';
import { OrderEntity } from '../orders/entities/order.entity';
import { StaffEntity } from '../staff/entities/staff.entity';
import { DeliveriesService } from './deliveries.service';
import { DeliveriesController } from './deliveries.controller';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DeliveryEntity, OrderEntity, StaffEntity]),
    ActivityLogModule,
    // Rider pickup/deliver route order-status changes through OrdersService so
    // ingredient deduction, cash settlement, events and pushes all fire.
    OrdersModule,
  ],
  controllers: [DeliveriesController],
  providers: [DeliveriesService],
  exports: [DeliveriesService],
})
export class DeliveriesModule {}
