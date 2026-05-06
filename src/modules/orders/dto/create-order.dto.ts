import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateOrderItemDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  comboId?: string;

  @ApiProperty({ example: 'Jollof Rice (Large)', description: 'Snapshot of product/combo name' })
  @IsString()
  name: string;

  @ApiProperty({ example: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({ example: 4500, description: 'Per-unit price in business currency' })
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Selected variation (e.g. size)',
  })
  @IsOptional()
  @IsObject()
  variation?: Record<string, unknown>;

  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
    description: 'Selected addons',
  })
  @IsOptional()
  @IsArray()
  addons?: Record<string, unknown>[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateOrderDto {
  @ApiProperty({ example: 'pos', enum: ['pos', 'website', 'phone'] })
  @IsOptional()
  @IsEnum(['pos', 'website', 'phone'])
  channel?: 'pos' | 'website' | 'phone';

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isDelivery?: boolean;

  @ApiPropertyOptional({ format: 'uuid', description: 'Existing customer to link this order to' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiPropertyOptional({ example: '+2348012345678' })
  @IsOptional()
  @IsString()
  customerPhone?: string;

  @ApiPropertyOptional({ example: 'T-12' })
  @IsOptional()
  @IsString()
  tableNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxAmount?: number;

  @ApiProperty({ type: () => [CreateOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
