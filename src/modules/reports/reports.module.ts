import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderEntity } from '../orders/entities/order.entity';
import { OrderItemEntity } from '../orders/entities/order-item.entity';
import { OrderStatusEventEntity } from '../orders/entities/order-status-event.entity';
import { DeliveryEntity } from '../deliveries/entities/delivery.entity';
import { ShiftEntity } from '../shifts/entities/shift.entity';
import { IngredientEntity } from '../ingredients/entities/ingredient.entity';
import { ExpenseEntity } from '../expenses/entities/expense.entity';
import { CustomerEntity } from '../customers/entities/customer.entity';
import { CashSessionEntity } from '../cash-sessions/entities/cash-session.entity';
import { ProductEntity } from '../products/entities/product.entity';
import { CategoryEntity } from '../categories/entities/category.entity';
import { IngredientMovementEntity } from '../ingredients/entities/ingredient-movement.entity';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { ReportsExporter } from './reports.exporter';

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
      CustomerEntity,
      CashSessionEntity,
      ProductEntity,
      CategoryEntity,
      IngredientMovementEntity,
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsExporter],
  exports: [ReportsService],
})
export class ReportsModule {}
