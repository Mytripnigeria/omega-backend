import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashSessionEntity } from './entities/cash-session.entity';
import { OrderEntity } from '../orders/entities/order.entity';
import { StaffEntity } from '../staff/entities/staff.entity';
import { CashSessionsService } from './cash-sessions.service';
import { CashSessionsController } from './cash-sessions.controller';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CashSessionEntity, OrderEntity, StaffEntity]),
    ActivityLogModule,
  ],
  controllers: [CashSessionsController],
  providers: [CashSessionsService],
  exports: [CashSessionsService],
})
export class CashSessionsModule {}
