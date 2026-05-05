import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderEntity } from '../orders/entities/order.entity';
import { OrderItemEntity } from '../orders/entities/order-item.entity';
import { OrderStatusEventEntity } from '../orders/entities/order-status-event.entity';
import { DeliveryEntity } from '../deliveries/entities/delivery.entity';
import { ShiftEntity } from '../shifts/entities/shift.entity';
import { IngredientEntity } from '../ingredients/entities/ingredient.entity';
import { ExpenseEntity } from '../expenses/entities/expense.entity';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrderEntity,
      OrderItemEntity,
      OrderStatusEventEntity,
      DeliveryEntity,
      ShiftEntity,
      IngredientEntity,
      ExpenseEntity,
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
