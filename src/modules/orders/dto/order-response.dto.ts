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

  @ApiPropertyOptional({
    nullable: true,
    example: 'CHW-8Q2K1',
    description:
      "The originating marketplace's own order reference, shown so staff can " +
      'quote it back to Chowdeck support.',
  })
  @Expose()
  externalReference: string | null;

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

  @ApiProperty({ example: 0 })
  @Expose()
  refundedAmount: number;

  @ApiProperty({ example: 0 })
  @Expose()
  pointsRedeemed: number;

  @ApiProperty({
    example: 0,
    description:
      'Naira value of the redeemed points — the portion of discountAmount that ' +
      'loyalty points paid for.',
  })
  @Expose()
  pointsValue: number;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  paymentMethodId: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  @Type(() => Date)
  paidAt: Date | null;

  @ApiPropertyOptional({ enum: ['pending', 'paid', 'failed', 'refunded'], nullable: true })
  @Expose()
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded' | null;

  @ApiPropertyOptional({
    enum: ['cash', 'card', 'wallet', 'points', 'paystack'],
    nullable: true,
  })
  @Expose()
  paymentChannel: 'cash' | 'card' | 'wallet' | 'points' | 'paystack' | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  paymentReference: string | null;

  @ApiProperty({ example: 0 })
  @Expose()
  deliveryFee: number;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  deliveryRegionId: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Lekki Phase 1' })
  @Expose()
  deliveryRegionName: string | null;

  @ApiProperty({ example: 0 })
  @Expose()
  tipAmount: number;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  couponCode: string | null;

  @ApiProperty({ example: 0 })
  @Expose()
  couponDiscount: number;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  deliveryAddressId: string | null;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true, nullable: true })
  @Expose()
  deliveryAddress: Record<string, unknown> | null;

  /**
   * Rider handling a marketplace delivery (Chowdeck sends theirs on the
   * order). Stored on the row since round 11 but never serialised, so the
   * dashboard's Delivery tab could not show it.
   */
  @ApiPropertyOptional({ nullable: true, example: 'Musa Ibrahim' })
  @Expose()
  riderName: string | null;

  @ApiPropertyOptional({ nullable: true, example: '+2348030000202' })
  @Expose()
  riderPhone: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  @Type(() => Date)
  scheduledFor: Date | null;

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

  @ApiPropertyOptional({
    nullable: true,
    example: 20,
    description: 'Estimated prep minutes = the longest item prep time.',
  })
  @Expose()
  estimatedPrepMinutes: number | null;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    description:
      'When the counter sent the order to the kitchen. The order stays ' +
      'PENDING; this records the hand-over, and is what moves a Cloove ' +
      'kitchen ticket to `queued`.',
  })
  @Expose()
  @Type(() => Date)
  sentToKitchenAt: Date | null;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'When the order entered PREPARING (kitchen countdown anchor).',
  })
  @Expose()
  @Type(() => Date)
  preparingStartedAt: Date | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Staff member who moved the order into PREPARING.',
  })
  @Expose()
  preparingStaffId: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 'Jenifer Okpe',
    description: 'Display name of whoever moved the order into PREPARING.',
  })
  @Expose()
  preparingStaffName: string | null;

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
        refundedAmount: Number(entity.refundedAmount ?? 0),
        deliveryFee: Number(entity.deliveryFee ?? 0),
        pointsValue: Number(entity.pointsValue ?? 0),
        tipAmount: Number(entity.tipAmount ?? 0),
        couponDiscount: Number(entity.couponDiscount ?? 0),
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
