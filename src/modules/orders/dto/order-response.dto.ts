import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import { OrderEntity, OrderChannel, OrderStatus } from '../entities/order.entity';
import { OrderItemEntity, PrepStatus } from '../entities/order-item.entity';

export class OrderItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  orderId: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  productId: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  comboId: string | null;

  @ApiProperty({ example: 'Jollof Rice (Large)' })
  @Expose()
  name: string;

  @ApiProperty({ example: 1 })
  @Expose()
  quantity: number;

  @ApiProperty({ example: 4500 })
  @Expose()
  unitPrice: number;

  @ApiProperty({ example: 4500 })
  @Expose()
  subtotal: number;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true, nullable: true })
  @Expose()
  variation: Record<string, unknown> | null;

  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
    nullable: true,
  })
  @Expose()
  addons: Record<string, unknown>[] | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  notes: string | null;

  @ApiProperty({ enum: ['pending', 'preparing', 'ready'] })
  @Expose()
  prepStatus: PrepStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(entity: OrderItemEntity): OrderItemResponseDto {
    return plainToInstance(OrderItemResponseDto, entity, {
      excludeExtraneousValues: true,
    });
  }
}

export class OrderResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ example: 42 })
  @Expose()
  orderNumber: number;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  businessId: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  storeId: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  staffId: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  staffName: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  customerId: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  customerName: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  customerPhone: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  tableNumber: string | null;

  @ApiProperty({ enum: ['pos', 'website', 'phone'] })
  @Expose()
  channel: OrderChannel;

  @ApiProperty({ example: false })
  @Expose()
  isDelivery: boolean;

  @ApiProperty({ enum: OrderStatus })
  @Expose()
  status: OrderStatus;

  @ApiProperty({ example: 4500 })
  @Expose()
  subtotal: number;

  @ApiProperty({ example: 337.5 })
  @Expose()
  taxAmount: number;

  @ApiProperty({ example: 0 })
  @Expose()
  discountAmount: number;

  @ApiProperty({ example: 4837.5 })
  @Expose()
  total: number;

  @ApiProperty({ example: 0 })
  @Expose()
  paidAmount: number;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  paymentMethodId: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  @Type(() => Date)
  paidAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  notes: string | null;

  @ApiProperty({ type: () => [OrderItemResponseDto] })
  @Expose()
  @Type(() => OrderItemResponseDto)
  items: OrderItemResponseDto[];

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(entity: OrderEntity): OrderResponseDto {
    return plainToInstance(
      OrderResponseDto,
      {
        ...entity,
        // Decimal columns return strings from pg; coerce to number for client.
        subtotal: Number(entity.subtotal),
        taxAmount: Number(entity.taxAmount),
        discountAmount: Number(entity.discountAmount),
        total: Number(entity.total),
        paidAmount: Number(entity.paidAmount),
        items: (entity.items ?? []).map((i) => ({
          ...i,
          unitPrice: Number(i.unitPrice),
          subtotal: Number(i.subtotal),
        })),
      },
      { excludeExtraneousValues: true },
    );
  }

  static fromMany(entities: OrderEntity[]): OrderResponseDto[] {
    return entities.map((e) => OrderResponseDto.from(e));
  }
}
