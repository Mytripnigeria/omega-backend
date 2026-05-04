import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessEntity } from './entities/business.entity';
import { BusinessSettingsEntity } from './entities/business-settings.entity';
import { BusinessService } from './business.service';
import { BusinessController } from './business.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [TypeOrmModule.forFeature([BusinessEntity, BusinessSettingsEntity]), StorageModule],
  controllers: [BusinessController],
  providers: [BusinessService],
  exports: [BusinessService, TypeOrmModule],
})
export class BusinessModule {}
