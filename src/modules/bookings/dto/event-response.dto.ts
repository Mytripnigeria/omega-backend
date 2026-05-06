import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import {
  EventEntity,
  EventStatus,
  EventType,
} from '../entities/event.entity';

export class EventResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  businessId: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  storeId: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  customerId: string | null;

  @ApiProperty()
  @Expose()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  description: string | null;

  @ApiProperty({ enum: EventType })
  @Expose()
  type: EventType;

  @ApiProperty()
  @Expose()
  date: string;

  @ApiProperty()
  @Expose()
  startTime: string;

  @ApiProperty()
  @Expose()
  endTime: string;

  @ApiProperty()
  @Expose()
  expectedGuests: number;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  confirmedGuests: number | null;

  @ApiProperty({ enum: EventStatus })
  @Expose()
  status: EventStatus;

  @ApiProperty()
  @Expose()
  contactName: string;

  @ApiProperty()
  @Expose()
  contactPhone: string;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  contactEmail: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  venueArea: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  deposit: number | null;

  @ApiProperty()
  @Expose()
  depositPaid: boolean;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  totalAmount: number | null;

  @ApiProperty()
  @Expose()
  paidAmount: number;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  notes: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(entity: EventEntity): EventResponseDto {
    return plainToInstance(
      EventResponseDto,
      {
        ...entity,
        deposit: entity.deposit == null ? null : Number(entity.deposit),
        totalAmount:
          entity.totalAmount == null ? null : Number(entity.totalAmount),
        paidAmount: Number(entity.paidAmount),
      },
      { excludeExtraneousValues: true },
    );
  }
}
