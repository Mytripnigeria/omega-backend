import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StaffEntity } from './entities/staff.entity';
import { StaffDocumentEntity } from './entities/staff-document.entity';
import { StoreEntity } from '../store/entities/store.entity';
import { BusinessSettingsEntity } from '../business/entities/business-settings.entity';
import { AdminEntity } from '../admin/entities/admin.entity';
import { StaffService } from './staff.service';
import { StaffController } from './staff.controller';
import { StaffPreferencesController } from './staff-preferences.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StaffEntity,
      StaffDocumentEntity,
      StoreEntity,
      BusinessSettingsEntity,
      AdminEntity,
    ]),
  ],
  // Preferences controller is registered first so /staff/me/preferences resolves
  // to a literal route before the admin CRUD controller's /staff/:id matchers.
  controllers: [StaffPreferencesController, StaffController],
  providers: [StaffService],
  exports: [StaffService],
})
export class StaffModule {}
