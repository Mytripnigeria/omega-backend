import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkstationSettingsEntity } from './entities/workstation-settings.entity';
import { WorkstationSettingsService } from './workstation-settings.service';
import { WorkstationSettingsController } from './workstation-settings.controller';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkstationSettingsEntity]),
    ActivityLogModule,
  ],
  controllers: [WorkstationSettingsController],
  providers: [WorkstationSettingsService],
  exports: [WorkstationSettingsService],
})
export class WorkstationSettingsModule {}
