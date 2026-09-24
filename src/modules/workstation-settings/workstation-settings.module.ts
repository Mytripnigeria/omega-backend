import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkstationSettingsEntity } from './entities/workstation-settings.entity';
import { WorkstationGeofenceEntity } from './entities/workstation-geofence.entity';
import { StoreEntity } from '../store/entities/store.entity';
import { BusinessSettingsEntity } from '../business/entities/business-settings.entity';
import { TaxRateEntity } from '../tax-rates/entities/tax-rate.entity';
import { WorkstationSettingsService } from './workstation-settings.service';
import { WorkstationSettingsController } from './workstation-settings.controller';
import {
  WorkstationFunctionAccessController,
  WorkstationReceiptController,
} from './workstation-receipt.controller';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkstationSettingsEntity,
      WorkstationGeofenceEntity,
      StoreEntity,
      BusinessSettingsEntity,
      TaxRateEntity,
    ]),
    ActivityLogModule,
  ],
  controllers: [
    WorkstationSettingsController,
    WorkstationReceiptController,
    WorkstationFunctionAccessController,
  ],
  providers: [WorkstationSettingsService],
  exports: [WorkstationSettingsService],
})
export class WorkstationSettingsModule {}
