import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShiftEntity } from './entities/shift.entity';
import { StaffEntity } from '../staff/entities/staff.entity';
import { WorkstationSettingsEntity } from '../workstation-settings/entities/workstation-settings.entity';
import { ShiftsService } from './shifts.service';
import { ShiftsController } from './shifts.controller';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { CashSessionsModule } from '../cash-sessions/cash-sessions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ShiftEntity,
      StaffEntity,
      WorkstationSettingsEntity,
    ]),
    ActivityLogModule,
    CashSessionsModule,
  ],
  controllers: [ShiftsController],
  providers: [ShiftsService],
  exports: [ShiftsService],
})
export class ShiftsModule {}
