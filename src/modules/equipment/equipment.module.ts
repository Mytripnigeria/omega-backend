import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EquipmentEntity } from './entities/equipment.entity';
import { EquipmentMaintenanceEntity } from './entities/equipment-maintenance.entity';
import { EquipmentTemperatureReadingEntity } from './entities/equipment-temperature-reading.entity';
import { EquipmentService } from './equipment.service';
import { EquipmentController } from './equipment.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EquipmentEntity,
      EquipmentMaintenanceEntity,
      EquipmentTemperatureReadingEntity,
    ]),
  ],
  controllers: [EquipmentController],
  providers: [EquipmentService],
  exports: [EquipmentService],
})
export class EquipmentModule {}
