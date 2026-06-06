import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KpiTargetEntity } from './entities/kpi-target.entity';
import { KpiPerformanceEntity } from './entities/kpi-performance.entity';
import { StaffEntity } from '../staff/entities/staff.entity';
import { RoleEntity } from '../roles/entities/role.entity';
import { OrderEntity } from '../orders/entities/order.entity';
import { KpiTargetsService } from './kpi-targets.service';
import { KpiTargetsController } from './kpi-targets.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      KpiTargetEntity,
      KpiPerformanceEntity,
      StaffEntity,
      RoleEntity,
      OrderEntity,
    ]),
  ],
  controllers: [KpiTargetsController],
  providers: [KpiTargetsService],
  exports: [KpiTargetsService],
})
export class KpiTargetsModule {}
