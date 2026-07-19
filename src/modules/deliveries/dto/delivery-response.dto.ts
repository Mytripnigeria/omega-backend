import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import { DeliveryEntity, DeliveryStatus } from '../entities/delivery.entity';

export class DeliveryResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  orderId: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  businessId: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  storeId: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  riderStaffId: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  riderName: string | null;

  @ApiProperty({ example: '14 Adeola Odeku St' })
  @Expose()
  address: string;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  phone: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  latitude: number | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  longitude: number | null;

  @ApiProperty({ enum: DeliveryStatus })
  @Expose()
  status: DeliveryStatus;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'When the waiter sent the order out to the delivery board.',
  })
  @Expose()
  @Type(() => Date)
  dispatchedAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  dispatchedByName: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  @Type(() => Date)
  assignedAt: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  @Type(() => Date)
  pickedUpAt: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  @Type(() => Date)
  deliveredAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  failureReason: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  notes: string | null;

  @ApiPropertyOptional({ description: 'Denormalised order number for display' })
  @Expose()
  orderNumber: number | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  customerName: string | null;

  @ApiPropertyOptional({
    description:
      'Denormalised order line items so the delivery board can show the full order.',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        quantity: { type: 'number' },
        unitPrice: { type: 'number' },
        variation: { type: 'object', nullable: true },
        addons: { type: 'array', nullable: true },
        notes: { type: 'string', nullable: true },
      },
    },
  })
  @Expose()
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    variation: unknown | null;
    addons: unknown[] | null;
    notes: string | null;
  }>;

  @ApiPropertyOptional({ nullable: true, description: 'Denormalised order total' })
  @Expose()
  orderTotal: number | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  orderStatus: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  orderNotes: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  paymentChannel: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  paymentStatus: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(entity: DeliveryEntity): DeliveryResponseDto {
    return plainToInstance(
      DeliveryResponseDto,
      {
        ...entity,
        latitude: entity.latitude == null ? null : Number(entity.latitude),
        longitude: entity.longitude == null ? null : Number(entity.longitude),
        orderNumber: entity.order?.orderNumber ?? null,
        customerName: entity.order?.customerName ?? null,
        items: (entity.order?.items ?? []).map((i) => ({
          name: i.name,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          variation: i.variation ?? null,
          addons: i.addons ?? null,
          notes: i.notes ?? null,
        })),
        orderTotal:
          entity.order?.total == null ? null : Number(entity.order.total),
        orderStatus: entity.order?.status ?? null,
        orderNotes: entity.order?.notes ?? null,
        paymentChannel: entity.order?.paymentChannel ?? null,
        paymentStatus: entity.order?.paymentStatus ?? null,
      },
      { excludeExtraneousValues: true },
    );
  }

  static fromMany(entities: DeliveryEntity[]): DeliveryResponseDto[] {
    return entities.map((e) => DeliveryResponseDto.from(e));
  }
}
