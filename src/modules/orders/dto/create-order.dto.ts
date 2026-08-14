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
  // @Type is required, not decorative: the global ValidationPipe runs with
  // enableImplicitConversion, and without an explicit element type
  // class-transformer reflects `Record<string, unknown>[]` as Array and
  // converts every add-on object into an empty array — silently dropping the
  // whole add-on selection from the order (and from receipts and stock
  // deduction along with it).
  @Type(() => Object)
  addons?: Record<string, unknown>[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateOrderDto {
  @ApiProperty({ example: 'pos', enum: ['pos', 'website', 'phone', 'chowdeck'] })
  @IsOptional()
  @IsEnum(['pos', 'website', 'phone', 'chowdeck'])
  channel?: 'pos' | 'website' | 'phone' | 'chowdeck';

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

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'TableEntity id when opening an order against a managed table. The backend snapshots the table\'s name into `tableNumber` and marks the table as occupied.',
  })
  @IsOptional()
  @IsString()
  tableId?: string;

  @ApiPropertyOptional({
    example: 'T-12',
    description:
      'Free-text table label (kiosks or shops without table management). Ignored when `tableId` is provided.',
  })
  @IsOptional()
  @IsString()
  tableNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Delivery region for a counter-taken delivery order. Its fee is applied ' +
      'server-side to deliveryFee — the POS never sets the price itself.',
  })
  @IsOptional()
  @IsUUID()
  deliveryRegionId?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description:
      'Delivery address captured at the counter, e.g. { line1, city, state }. ' +
      'Snapshotted onto the order so the rider sees a real address.',
  })
  @IsOptional()
  @IsObject()
  deliveryAddress?: Record<string, unknown>;

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

  @ApiPropertyOptional({
    example: false,
    description:
      'When true the cashier is accepting the order as they create it ' +
      '(e.g. "Process Bill" at the counter): it skips INITIATED and starts at ' +
      'PENDING. New orders otherwise start at INITIATED awaiting acceptance.',
  })
  @IsOptional()
  @IsBoolean()
  accept?: boolean;

  @ApiPropertyOptional({
    example: false,
    description:
      '"Quick Bill" — the order only contains ready-made items (snacks/drinks) ' +
      'so it skips the kitchen flow (PENDING → PREPARING) and is created READY.',
  })
  @IsOptional()
  @IsBoolean()
  quickBill?: boolean;

  @ApiProperty({ type: () => [CreateOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
