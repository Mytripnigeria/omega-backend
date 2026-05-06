import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
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

export class StorefrontOrderItemDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  comboId?: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({ description: 'Per-unit price (kobo)' })
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  variation?: Record<string, unknown>;

  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
  })
  @IsOptional()
  @IsArray()
  addons?: Record<string, unknown>[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export type StorefrontPaymentChannel =
  | 'cash'
  | 'paystack'
  | 'wallet'
  | 'points';

export class StorefrontCreateOrderDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  storeId: string;

  @ApiProperty()
  @IsBoolean()
  isDelivery: boolean;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Saved address id (required when isDelivery=true and addressSnapshot is not provided)',
  })
  @IsOptional()
  @IsUUID()
  deliveryAddressId?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Inline delivery address (used when no saved address id)',
  })
  @IsOptional()
  @IsObject()
  deliveryAddress?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'ISO 8601 scheduled time; null = ASAP' })
  @IsOptional()
  @IsDateString()
  scheduledFor?: string;

  @ApiProperty({ type: () => [StorefrontOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StorefrontOrderItemDto)
  items: StorefrontOrderItemDto[];

  @ApiProperty({ enum: ['cash', 'paystack', 'wallet', 'points'] })
  @IsEnum(['cash', 'paystack', 'wallet', 'points'])
  paymentChannel: StorefrontPaymentChannel;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Saved payment method (only valid when paymentChannel=paystack)',
  })
  @IsOptional()
  @IsUUID()
  savedPaymentMethodId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  couponCode?: string;

  @ApiPropertyOptional({ description: 'Tip amount in business currency (kobo)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tipAmount?: number;

  @ApiPropertyOptional({ description: 'Loyalty points to redeem' })
  @IsOptional()
  @IsInt()
  @Min(0)
  pointsToRedeem?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class VerifyOrderPaymentDto {
  @ApiProperty()
  @IsString()
  reference: string;
}
