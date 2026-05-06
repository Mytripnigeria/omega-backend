import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import {
  EquipmentCategory,
  EquipmentStatus,
} from '../entities/equipment.entity';
import { MaintenanceType } from '../entities/equipment-maintenance.entity';

export class CreateEquipmentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  storeId: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiProperty({ example: 'Walk-in Freezer A1' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({ enum: EquipmentCategory })
  @IsEnum(EquipmentCategory)
  category: EquipmentCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serialNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  manufacturer?: string;

  @ApiPropertyOptional({ example: '2024-06-15' })
  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @ApiPropertyOptional({ example: 850000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  purchasePrice?: number;

  @ApiPropertyOptional({ example: '2027-06-15' })
  @IsOptional()
  @IsDateString()
  warrantyExpiry?: string;

  @ApiPropertyOptional({ enum: EquipmentStatus, default: EquipmentStatus.OPERATIONAL })
  @IsOptional()
  @IsEnum(EquipmentStatus)
  status?: EquipmentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  currentTemperature?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  targetTemperature?: number;

  @ApiPropertyOptional({ example: '2026-04-01' })
  @IsOptional()
  @IsDateString()
  lastMaintenanceDate?: string;

  @ApiPropertyOptional({ example: '2026-07-01' })
  @IsOptional()
  @IsDateString()
  nextMaintenanceDate?: string;

  @ApiPropertyOptional({ example: 90 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maintenanceCycleDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateEquipmentDto extends PartialType(
  OmitType(CreateEquipmentDto, ['storeId'] as const),
) {}

export class EquipmentFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiPropertyOptional({ enum: EquipmentCategory })
  @IsOptional()
  @IsEnum(EquipmentCategory)
  category?: EquipmentCategory;

  @ApiPropertyOptional({ enum: EquipmentStatus })
  @IsOptional()
  @IsEnum(EquipmentStatus)
  status?: EquipmentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}

export class CreateMaintenanceLogDto {
  @ApiProperty({ enum: MaintenanceType })
  @IsEnum(MaintenanceType)
  type: MaintenanceType;

  @ApiProperty({ example: '2026-04-01' })
  @IsDateString()
  performedOn: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  performedBy?: string;

  @ApiPropertyOptional({ example: 12500 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  description: string;
}
