import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { TableEntity, TableStatus } from '../entities/table.entity';

export class CreateTableDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  storeId!: string;

  @ApiProperty({ example: 'T-12' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional({ example: 'Patio' })
  @IsOptional()
  @IsString()
  section?: string;

  @ApiPropertyOptional({ example: 4, default: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  capacity?: number;

  @ApiPropertyOptional({ enum: TableStatus, default: TableStatus.AVAILABLE })
  @IsOptional()
  @IsEnum(TableStatus)
  status?: TableStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  positionX?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  positionY?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateTableDto extends PartialType(
  OmitType(CreateTableDto, ['storeId'] as const),
) {}

export class UpdateTableStatusDto {
  @ApiProperty({ enum: TableStatus })
  @IsEnum(TableStatus)
  status!: TableStatus;
}

export class TableFilterDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiPropertyOptional({ enum: TableStatus })
  @IsOptional()
  @IsEnum(TableStatus)
  status?: TableStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  section?: string;
}

export class TableResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id!: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  businessId!: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  storeId!: string;

  @ApiProperty()
  @Expose()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  section!: string | null;

  @ApiProperty()
  @Expose()
  capacity!: number;

  @ApiProperty({ enum: TableStatus })
  @Expose()
  status!: TableStatus;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  positionX!: number | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  positionY!: number | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  notes!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt!: Date;

  static from(entity: TableEntity): TableResponseDto {
    return plainToInstance(TableResponseDto, entity, {
      excludeExtraneousValues: true,
    });
  }

  static fromMany(entities: TableEntity[]): TableResponseDto[] {
    return entities.map((e) => TableResponseDto.from(e));
  }
}
