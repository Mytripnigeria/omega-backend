import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import {
  EquipmentCategory,
  EquipmentEntity,
  EquipmentStatus,
} from '../entities/equipment.entity';
import {
  EquipmentMaintenanceEntity,
  MaintenanceType,
} from '../entities/equipment-maintenance.entity';

export class EquipmentResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  storeId: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  locationId: string | null;

  @ApiProperty()
  @Expose()
  name: string;

  @ApiProperty({ enum: EquipmentCategory })
  @Expose()
  category: EquipmentCategory;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  description: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  serialNumber: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  model: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  manufacturer: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  purchaseDate: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  purchasePrice: number | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  warrantyExpiry: string | null;

  @ApiProperty({ enum: EquipmentStatus })
  @Expose()
  status: EquipmentStatus;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  currentTemperature: number | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  targetTemperature: number | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  lastMaintenanceDate: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  nextMaintenanceDate: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  maintenanceCycleDays: number | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  uptime: number | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  notes: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(entity: EquipmentEntity): EquipmentResponseDto {
    return plainToInstance(
      EquipmentResponseDto,
      {
        ...entity,
        purchasePrice:
          entity.purchasePrice == null ? null : Number(entity.purchasePrice),
        currentTemperature:
          entity.currentTemperature == null
            ? null
            : Number(entity.currentTemperature),
        targetTemperature:
          entity.targetTemperature == null
            ? null
            : Number(entity.targetTemperature),
        uptime: entity.uptime == null ? null : Number(entity.uptime),
      },
      { excludeExtraneousValues: true },
    );
  }
}

export class MaintenanceLogResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  equipmentId: string;

  @ApiProperty({ enum: MaintenanceType })
  @Expose()
  type: MaintenanceType;

  @ApiProperty()
  @Expose()
  performedOn: string;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  performedBy: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  cost: number | null;

  @ApiProperty()
  @Expose()
  description: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  static from(entity: EquipmentMaintenanceEntity): MaintenanceLogResponseDto {
    return plainToInstance(
      MaintenanceLogResponseDto,
      { ...entity, cost: entity.cost == null ? null : Number(entity.cost) },
      { excludeExtraneousValues: true },
    );
  }
}
