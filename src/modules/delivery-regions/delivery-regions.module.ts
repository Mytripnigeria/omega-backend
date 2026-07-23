import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeliveryRegionEntity } from './entities/delivery-region.entity';
import { DeliveryRegionsService } from './delivery-regions.service';
import { DeliveryRegionsController } from './delivery-regions.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DeliveryRegionEntity])],
  controllers: [DeliveryRegionsController],
  providers: [DeliveryRegionsService],
  exports: [DeliveryRegionsService, TypeOrmModule],
})
export class DeliveryRegionsModule {}
