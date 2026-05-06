import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { InventoryLocationType } from '../entities/inventory-location.entity';

export class CreateInventoryLocationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  storeId: string;

  @ApiProperty({ example: 'Main Kitchen Storage' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({ enum: InventoryLocationType })
  @IsEnum(InventoryLocationType)
  type: InventoryLocationType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
