import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import { OrderStatusEventEntity } from '../entities/order-status-event.entity';
import { OrderStatus } from '../entities/order.entity';

export class OrderStatusEventResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  orderId: string;

  @ApiPropertyOptional({ enum: OrderStatus, nullable: true })
  @Expose()
  fromStatus: OrderStatus | null;

  @ApiProperty({ enum: OrderStatus })
  @Expose()
  toStatus: OrderStatus;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  actorId: string | null;

  @ApiPropertyOptional({ enum: ['admin', 'staff', 'user', 'system'], nullable: true })
  @Expose()
  actorType: 'admin' | 'staff' | 'user' | 'system' | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  reason: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  static from(entity: OrderStatusEventEntity): OrderStatusEventResponseDto {
    return plainToInstance(OrderStatusEventResponseDto, entity, {
      excludeExtraneousValues: true,
    });
  }
}
