import { ApiProperty, ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { DeliveryRegionEntity } from '../entities/delivery-region.entity';

export class CreateDeliveryRegionDto {
  @ApiProperty({ format: 'uuid', description: 'Store this region belongs to' })
  @IsUUID()
  storeId: string;

  @ApiProperty({ example: 'Lekki Phase 1' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Includes Admiralty Way and Freedom Way' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 1500 })
  @IsNumber()
  @Min(0)
  fee: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderAmount?: number;

  @ApiPropertyOptional({ example: 45 })
  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedMinutes?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateDeliveryRegionDto extends PartialType(
  OmitType(CreateDeliveryRegionDto, ['storeId'] as const),
) {}

export class DeliveryRegionFilterDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiPropertyOptional({ description: 'true = only active regions' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}

export class DeliveryRegionResponseDto {
  @ApiProperty({ format: 'uuid' }) @Expose() id: string;
  @ApiProperty({ format: 'uuid' }) @Expose() storeId: string;
  @ApiProperty() @Expose() name: string;
  @ApiPropertyOptional({ nullable: true }) @Expose() description: string | null;
  @ApiProperty({ example: 1500 }) @Expose() fee: number;
  @ApiProperty({ example: 0 }) @Expose() minOrderAmount: number;
  @ApiPropertyOptional({ nullable: true }) @Expose() estimatedMinutes: number | null;
  @ApiProperty() @Expose() isActive: boolean;
  @ApiProperty() @Expose() sortOrder: number;
  @ApiProperty({ type: String, format: 'date-time' }) @Expose() createdAt: Date;
  @ApiProperty({ type: String, format: 'date-time' }) @Expose() updatedAt: Date;

  static from(e: DeliveryRegionEntity): DeliveryRegionResponseDto {
    return {
      id: e.id,
      storeId: e.storeId,
      name: e.name,
      description: e.description ?? null,
      fee: Number(e.fee),
      minOrderAmount: Number(e.minOrderAmount),
      estimatedMinutes: e.estimatedMinutes ?? null,
      isActive: e.isActive,
      sortOrder: e.sortOrder,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    };
  }
}
