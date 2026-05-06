import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryLocationEntity } from './entities/inventory-location.entity';
import { InventoryLocationsService } from './inventory-locations.service';
import { InventoryLocationsController } from './inventory-locations.controller';

@Module({
  imports: [TypeOrmModule.forFeature([InventoryLocationEntity])],
  controllers: [InventoryLocationsController],
  providers: [InventoryLocationsService],
  exports: [InventoryLocationsService, TypeOrmModule],
})
export class InventoryLocationsModule {}
