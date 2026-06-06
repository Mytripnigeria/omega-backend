import {
  ApiProperty,
  ApiPropertyOptional,
  PartialType,
} from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import {
  KpiAssignmentType,
  KpiCategory,
  KpiPeriod,
  KpiStatus,
  KpiTargetEntity,
} from '../entities/kpi-target.entity';

export class CreateKpiTargetDto {
  @ApiProperty({ example: 'Revenue Target' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  storeId: string;

  @ApiProperty({ enum: KpiCategory })
  @IsEnum(KpiCategory)
  category: KpiCategory;

  @ApiProperty({ enum: KpiAssignmentType })
  @IsEnum(KpiAssignmentType)
  assignmentType: KpiAssignmentType;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'roleId or staffId. Required when assignmentType is "role" or "staff"; omit for "all_staff".',
  })
  @ValidateIf((o) => o.assignmentType !== KpiAssignmentType.ALL_STAFF)
  @IsUUID()
  assignedToId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedToName?: string;

  @ApiProperty({ enum: KpiPeriod })
  @IsEnum(KpiPeriod)
  period: KpiPeriod;

  @ApiProperty({ example: 100000, minimum: 0 })
  @IsNumber()
  @Min(0)
  targetValue: number;

  @ApiPropertyOptional({ example: '₦' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ example: '2026-06-01' })
  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @ApiPropertyOptional({ example: '2026-06-30' })
  @IsOptional()
  @IsDateString()
  periodEnd?: string;
}

export class UpdateKpiTargetDto extends PartialType(CreateKpiTargetDto) {}

export class RecordKpiPerformanceDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  staffId: string;

  @ApiProperty({ example: 15000, minimum: 0 })
  @IsNumber()
  @Min(0)
  value: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class KpiTargetFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiPropertyOptional({ enum: KpiCategory })
  @IsOptional()
  @IsEnum(KpiCategory)
  category?: KpiCategory;

  @ApiPropertyOptional({ enum: KpiAssignmentType })
  @IsOptional()
  @IsEnum(KpiAssignmentType)
  assignmentType?: KpiAssignmentType;

  @ApiPropertyOptional({ enum: KpiPeriod })
  @IsOptional()
  @IsEnum(KpiPeriod)
  period?: KpiPeriod;

  @ApiPropertyOptional({ enum: KpiStatus })
  @IsOptional()
  @IsEnum(KpiStatus)
  status?: KpiStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}

export class KpiTargetResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  businessId: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  storeId: string;

  @ApiProperty()
  @Expose()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  description: string | null;

  @ApiProperty({ enum: KpiCategory })
  @Expose()
  category: KpiCategory;

  @ApiProperty({ enum: KpiAssignmentType })
  @Expose()
  assignmentType: KpiAssignmentType;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  assignedToId: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  assignedToName: string | null;

  @ApiProperty({ enum: KpiPeriod })
  @Expose()
  period: KpiPeriod;

  @ApiProperty()
  @Expose()
  targetValue: number;

  @ApiProperty()
  @Expose()
  currentValue: number;

  @ApiProperty()
  @Expose()
  unit: string;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  periodStart: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  periodEnd: string | null;

  @ApiProperty({ enum: KpiStatus })
  @Expose()
  status: KpiStatus;

  @ApiProperty({ description: 'Progress percentage (0-100+).' })
  @Expose()
  progress: number;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(entity: KpiTargetEntity): KpiTargetResponseDto {
    const target = Number(entity.targetValue);
    const current = Number(entity.currentValue);
    const progress = target > 0 ? Math.round((current / target) * 100) : 0;
    return plainToInstance(
      KpiTargetResponseDto,
      {
        ...entity,
        targetValue: target,
        currentValue: current,
        progress,
      },
      { excludeExtraneousValues: true },
    );
  }
}

export class KpiPerformanceRowDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  staffId: string;

  @ApiProperty()
  @Expose()
  staffName: string;

  @ApiProperty({
    example: 15000,
    description: 'Staff contribution to the target during the active period.',
  })
  @Expose()
  value: number;

  @ApiProperty({
    example: 25000,
    description: 'Per-staff implied target (target / number of contributors).',
  })
  @Expose()
  share: number;

  @ApiProperty({
    description: 'Per-staff progress percent (value / share).',
  })
  @Expose()
  progress: number;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  roleName: string | null;

  @ApiPropertyOptional({
    description:
      'Whether the value was auto-computed from orders (sales/orders categories) or manually recorded.',
  })
  @Expose()
  source: 'computed' | 'manual';
}
