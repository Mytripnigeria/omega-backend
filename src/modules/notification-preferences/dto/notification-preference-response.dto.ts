import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import {
  NotificationChannels,
  NotificationEventToggles,
  NotificationPreferenceEntity,
} from '../entities/notification-preference.entity';

export class NotificationPreferenceResponseDto {
  @ApiProperty({ format: 'uuid', example: '3a1b2c3d-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Expose()
  adminId: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: { email: true, sms: false, push: true, doNotDisturb: false },
    description: 'Delivery channel preferences. `doNotDisturb` disables all channels during quiet hours.',
  })
  @Expose()
  channels: NotificationChannels;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: {
      newOrder: true,
      newCustomer: false,
      lowStock: true,
      dailyReport: true,
      paymentReceived: true,
      shiftReminder: false,
    },
  })
  @Expose()
  events: NotificationEventToggles;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(entity: NotificationPreferenceEntity): NotificationPreferenceResponseDto {
    return plainToInstance(NotificationPreferenceResponseDto, entity, {
      excludeExtraneousValues: true,
    });
  }
}
