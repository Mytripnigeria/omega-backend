import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import {
  ReservationEntity,
  ReservationStatus,
} from '../entities/reservation.entity';

export class ReservationResponseDto {
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
  customerName: string;

  @ApiProperty()
  @Expose()
  customerPhone: string;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  customerEmail: string | null;

  @ApiProperty()
  @Expose()
  partySize: number;

  @ApiProperty()
  @Expose()
  date: string;

  @ApiProperty()
  @Expose()
  time: string;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  duration: number | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  tableNumber: string | null;

  @ApiProperty({ enum: ReservationStatus })
  @Expose()
  status: ReservationStatus;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  notes: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  specialRequests: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  @Type(() => Date)
  seatedAt: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  @Type(() => Date)
  completedAt: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  @Type(() => Date)
  cancelledAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  cancellationReason: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(entity: ReservationEntity): ReservationResponseDto {
    return plainToInstance(ReservationResponseDto, entity, {
      excludeExtraneousValues: true,
    });
  }
}
